"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  userId: string;
  onUpdate: () => void;
}

export default function AddAllowanceForm({ userId, onUpdate }: Props) {
  const [amount, setAmount] = useState<number | "">("");
  const [message, setMessage] = useState<string>("");
  const [savingsPercent, setSavingsPercent] = useState<number>(20);

  // Fetch user's preferred savings percent
  const fetchSavingsPercent = async () => {
    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("savings_percent")
        .eq("id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No settings found, use default
          console.log("No savings settings found, using default 20%");
          return;
        }
        throw error;
      }

      if (data?.savings_percent) {
        console.log("Fetched savings percent:", data.savings_percent);
        setSavingsPercent(data.savings_percent);
      }
    } catch (err) {
      console.error("Error fetching savings percent:", err);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchSavingsPercent();
      
      // Set up real-time subscription for user_settings changes
      const channel = supabase
        .channel('user_settings_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_settings',
            filter: `id=eq.${userId}`
          },
          (payload) => {
            console.log('Settings changed detected:', payload);
            if (payload.new && 'savings_percent' in payload.new) {
              const newPercent = payload.new.savings_percent as number;
              console.log('Updating savings percent to:', newPercent);
              setSavingsPercent(newPercent);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [userId]);

  const handleAddAllowance = async () => {
    if (!amount || amount <= 0) {
      setMessage("Enter a valid amount.");
      return;
    }

    try {
      // Insert transaction
      const { error: txnError } = await supabase.from("transactions").insert({
        user_id: userId,
        amount,
        type: "allowance",
      });
      if (txnError) throw txnError;

      // Fetch existing savings
      const { data: existingSavings, error: getError } = await supabase
        .from("savings")
        .select("locked_amount")
        .eq("user_id", userId)
        .single();

      if (getError && getError.code !== "PGRST116") throw getError;

      const locked = existingSavings ? Number(existingSavings.locked_amount) : 0;
      const savingsAmount = amount * (savingsPercent / 100);
      const newLocked = locked + savingsAmount;

      if (existingSavings) {
        const { error: updateError } = await supabase
          .from("savings")
          .update({ locked_amount: newLocked })
          .eq("user_id", userId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("savings")
          .insert({ user_id: userId, locked_amount: newLocked });
        if (insertError) throw insertError;
      }

      setMessage(`$${savingsAmount.toFixed(2)} (${savingsPercent}%) saved automatically.`);
      setAmount("");
      onUpdate();
    } catch (err) {
      console.error("Error in handleAddAllowance:", err);
      setMessage("Error saving allowance. Please try again.");
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4 text-black">Add Allowance</h3>

      <input
        type="number"
        value={amount === "" ? "" : amount}
        onChange={(e) => setAmount(parseFloat(e.target.value))}
        className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Enter allowance amount"
        min="0.01"
        step="0.01"
      />

      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>{savingsPercent}%</strong> (${(amount && amount > 0 ? (amount * (savingsPercent / 100)).toFixed(2) : "0.00")}) will be automatically saved
        </p>
      </div>

      <button
        onClick={handleAddAllowance}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
      >
        Add Allowance
      </button>

      {message && (
        <p className={`mt-3 text-sm ${
          message.includes("Error") ? "text-red-600" : "text-green-600"
        }`}>
          {message}
        </p>
      )}
    </div>
  );
}
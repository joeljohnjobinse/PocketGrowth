"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  userId: string;
  onUpdate: () => void;
}

export default function AddAllowanceForm({ userId, onUpdate }: Props) {
  const [amount, setAmount] = useState<string>(""); // Changed to string to avoid NaN
  const [message, setMessage] = useState<string>("");
  const [savingsPercent, setSavingsPercent] = useState<number>(20);
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
          console.log("No custom savings settings, using default 20%");
          return;
        }
        console.error("Error fetching savings percent:", error);
        return;
      }

      if (data?.savings_percent) {
        console.log("Using savings percent:", data.savings_percent);
        setSavingsPercent(data.savings_percent);
      }
    } catch (err) {
      console.error("Error in fetchSavingsPercent:", err);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchSavingsPercent();

      // Set up real-time subscription
      const channel = supabase
        .channel('user_settings_changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_settings',
            filter: `id=eq.${userId}`
          },
          (payload) => {
            console.log('Settings updated:', payload);
            if (payload.new && 'savings_percent' in payload.new) {
              const newPercent = payload.new.savings_percent as number;
              console.log('Updating to new percent:', newPercent);
              setSavingsPercent(newPercent);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_settings',
            filter: `id=eq.${userId}`
          },
          (payload) => {
            console.log('Settings inserted:', payload);
            if (payload.new && 'savings_percent' in payload.new) {
              const newPercent = payload.new.savings_percent as number;
              console.log('Setting new percent:', newPercent);
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

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const getNumericAmount = (): number => {
    if (amount === "" || amount === ".") return 0;
    return parseFloat(amount) || 0;
  };

  const handleAddAllowance = async () => {
    const numericAmount = getNumericAmount();
    if (numericAmount <= 0) {
      setMessage("Please enter a valid amount.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      // Insert transaction
      const { error: txnError } = await supabase.from("transactions").insert({
        user_id: userId,
        amount: numericAmount,
        type: "allowance",
      });

      if (txnError) throw txnError;

      // Calculate savings amount
      const savingsAmount = numericAmount * (savingsPercent / 100);

      // Update or create savings record
      const { data: existingSavings, error: savingsError } = await supabase
        .from("savings")
        .select("locked_amount")
        .eq("user_id", userId)
        .single();

      if (savingsError && savingsError.code !== "PGRST116") throw savingsError;

      const currentLocked = existingSavings ? Number(existingSavings.locked_amount) : 0;
      const newLocked = currentLocked + savingsAmount;

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

      setMessage(`✅ $${numericAmount.toFixed(2)} added! $${savingsAmount.toFixed(2)} (${savingsPercent}%) saved automatically.`);
      setAmount("");
      onUpdate();
    } catch (err: any) {
      console.error("Error adding allowance:", err);
      setMessage("Error adding allowance. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const numericAmount = getNumericAmount();
  const calculatedSavings = numericAmount > 0 ? (numericAmount * (savingsPercent / 100)).toFixed(2) : "0.00";
  const displayAmount = amount === "" ? "0" : numericAmount.toFixed(2);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-4 text-black">Add Allowance</h3>

      <input
        type="text" // Changed to text to have better control
        inputMode="decimal" // Shows numeric keyboard on mobile
        value={amount}
        onChange={handleAmountChange}
        className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Enter amount"
      />

      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800 font-medium">
          Savings Rate: <span className="text-green-600">{savingsPercent}%</span>
        </p>
        <p className="text-sm text-blue-800 mt-1">
          Amount to save: <span className="font-bold">${calculatedSavings}</span>
        </p>
        <p className="text-xs text-blue-600 mt-2">
          Change savings percentage in Account Settings
        </p>
      </div>

      <button
        onClick={handleAddAllowance}
        disabled={isLoading || numericAmount <= 0}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
      >
        {isLoading ? "Processing..." : `Add $${displayAmount}`}
      </button>

      {message && (
        <p className={`mt-3 text-sm ${
          message.includes("✅") ? "text-green-600" : "text-red-600"
        }`}>
          {message}
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  userId: string;
  currentLocked: number;
  onUpdate: () => void;
}

const UNLOCK_REASONS = [
  { id: "emergency", label: "Emergency expense", description: "Unexpected medical bill, car repair, etc." },
  { id: "education", label: "Education", description: "Books, courses, school fees" },
  { id: "investment", label: "Investment opportunity", description: "Stocks, business, real estate" },
  { id: "travel", label: "Travel", description: "Vacation or necessary travel" },
  { id: "family", label: "Family needs", description: "Supporting family members" },
  { id: "health", label: "Health & Wellness", description: "Gym membership, therapy, medical needs" },
  { id: "goal", label: "Specific goal purchase", description: "Down payment, vehicle, equipment" },
  { id: "other", label: "Other reason", description: "Please specify in notes" }
];

export default function UnlockForm({ userId, currentLocked, onUpdate }: Props) {
  const [amount, setAmount] = useState<string>("");
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const getNumericAmount = (): number => {
    if (amount === "" || amount === ".") return 0;
    return parseFloat(amount) || 0;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only numbers and decimal point
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleUnlock = async () => {
    const numericAmount = getNumericAmount();
    
    if (numericAmount <= 0 || numericAmount > currentLocked) {
      setMessage(`Enter a valid amount up to $${currentLocked.toFixed(2)}`);
      return;
    }

    if (!selectedReason) {
      setMessage("Please select a reason for unlocking your savings");
      return;
    }

    if (selectedReason === "other" && !notes.trim()) {
      setMessage("Please provide details for your reason");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      // Prepare transaction data (handle case where notes column might not exist)
      const transactionData: any = {
        user_id: userId,
        amount: numericAmount,
        type: "unlock",
        reason: selectedReason
      };

      // Only add notes if it's not empty
      if (notes.trim()) {
        transactionData.notes = notes.trim();
      }

      // Insert unlock transaction
      const { error: txnError } = await supabase
        .from("transactions")
        .insert(transactionData);

      if (txnError) {
        console.error("Transaction error:", txnError);
        
        // If notes column doesn't exist, try without notes
        if (txnError.message.includes("notes") || txnError.message.includes("column")) {
          console.log("Retrying without notes column...");
          const { error: retryError } = await supabase
            .from("transactions")
            .insert({
              user_id: userId,
              amount: numericAmount,
              type: "unlock",
              reason: selectedReason
            });

          if (retryError) {
            console.error("Retry error:", retryError);
            throw retryError;
          }
        } else {
          throw txnError;
        }
      }

      const newLocked = currentLocked - numericAmount;

      // Update savings
      const { data: existingSavings, error: savingsError } = await supabase
        .from("savings")
        .select("locked_amount")
        .eq("user_id", userId)
        .single();

      if (savingsError && savingsError.code !== "PGRST116") {
        console.error("Savings fetch error:", savingsError);
        throw savingsError;
      }

      if (existingSavings) {
        const { error: updateError } = await supabase
          .from("savings")
          .update({ locked_amount: newLocked })
          .eq("user_id", userId);

        if (updateError) {
          console.error("Update error:", updateError);
          throw updateError;
        }
      } else {
        const { error: insertError } = await supabase
          .from("savings")
          .insert({ user_id: userId, locked_amount: newLocked });

        if (insertError) {
          console.error("Insert error:", insertError);
          throw insertError;
        }
      }

      setMessage(`Successfully unlocked $${numericAmount.toFixed(2)} for ${UNLOCK_REASONS.find(r => r.id === selectedReason)?.label}`);
      setAmount("");
      setSelectedReason("");
      setNotes("");
      onUpdate();
    } catch (err: any) {
      console.error("Error unlocking:", err);
      
      let errorMessage = "Error unlocking. Please try again.";
      
      if (err.code === "42501") {
        errorMessage = "Permission denied. Please check database permissions.";
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }
      
      setMessage(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const numericAmount = getNumericAmount();
  const isAmountValid = numericAmount > 0 && numericAmount <= currentLocked;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-lg font-semibold mb-4 text-black">Unlock Savings</h3>
      
      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Amount to Unlock
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={handleAmountChange}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder={`Max: $${currentLocked.toFixed(2)}`}
        />
        {amount && !isAmountValid && (
          <p className="text-sm text-red-600 mt-1">
            Amount must be between $0.01 and ${currentLocked.toFixed(2)}
          </p>
        )}
      </div>

      {/* Reason Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reason for Unlocking
        </label>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {UNLOCK_REASONS.map((reason) => (
            <label key={reason.id} className="flex items-start space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input
                type="radio"
                name="unlock-reason"
                value={reason.id}
                checked={selectedReason === reason.id}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="mt-1 text-green-600 focus:ring-green-500"
              />
              <div className="flex-1">
                <span className="block text-sm font-medium text-gray-900">{reason.label}</span>
                <span className="block text-xs text-gray-500">{reason.description}</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Notes for Other Reason */}
      {selectedReason === "other" && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Please specify your reason
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Explain why you need to unlock these savings..."
            rows={3}
          />
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleUnlock}
        disabled={isSubmitting || !isAmountValid || !selectedReason || (selectedReason === "other" && !notes.trim())}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
      >
        {isSubmitting ? "Processing..." : `Unlock $${numericAmount > 0 ? numericAmount.toFixed(2) : "0"}`}
      </button>
      
      {message && (
        <p className={`mt-3 text-sm ${message.includes("Error") ? "text-red-600" : "text-green-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

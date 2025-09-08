"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  userId: string;
  onUpdate: () => void;
}

export default function AccountSettingsForm({ userId, onUpdate }: Props) {
  const [savingsPercent, setSavingsPercent] = useState<number>(20);
  const [message, setMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Fetch current savings percent
  const fetchSavingsPercent = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("user_settings")
        .select("savings_percent")
        .eq("id", userId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No record found, use default
          console.log("No existing settings found, using default 20%");
          return;
        }
        console.error("Fetch error:", error);
        throw error;
      }

      if (data?.savings_percent) {
        setSavingsPercent(data.savings_percent);
      }
    } catch (err: any) {
      console.error("Error fetching savings percent:", err);
      setMessage("Failed to load savings settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchSavingsPercent();
    }
  }, [userId]);

  const handleUpdate = async () => {
    try {
      setMessage("");
      setIsLoading(true);

      // Use upsert to handle both insert and update in one operation
      const { error } = await supabase
        .from("user_settings")
        .upsert(
          { 
            id: userId, 
            savings_percent: savingsPercent,
            updated_at: new Date().toISOString()
          },
          {
            onConflict: 'id',
            ignoreDuplicates: false
          }
        );

      if (error) {
        console.error("Upsert error:", error);
        throw error;
      }

      setMessage(`✅ Savings preference updated to ${savingsPercent}%`);
      onUpdate();
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      console.error("Error updating savings percent:", err);
      
      let errorMessage = "Failed to update savings preference.";
      if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }
      
      setMessage(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-black">Account Settings</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-2 bg-gray-200 rounded w-full mb-6"></div>
          <div className="h-10 bg-gray-200 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow duration-300">
      <h3 className="text-lg font-semibold mb-4 text-black">Account Settings</h3>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Savings Percentage: <span className="font-bold text-green-600">{savingsPercent}%</span>
        </label>
        <input
          type="range"
          min={5}
          max={50}
          value={savingsPercent}
          onChange={(e) => setSavingsPercent(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #10b981 0%, #10b981 ${savingsPercent}%, #e5e7eb ${savingsPercent}%, #e5e7eb 100%)`
          }}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>5%</span>
          <span>15%</span>
          <span>25%</span>
          <span>35%</span>
          <span>50%</span>
        </div>
        <p className="text-sm text-gray-600 mt-2">
          This percentage of your allowance will be automatically saved when you add money.
        </p>
      </div>

      <button
        onClick={handleUpdate}
        disabled={isLoading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Updating...
          </>
        ) : (
          "Update Savings Preference"
        )}
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
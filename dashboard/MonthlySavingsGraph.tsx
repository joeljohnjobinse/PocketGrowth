"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

type Interval = "daily" | "weekly" | "monthly" | "yearly";

interface SavingsData {
  x: string;
  y: number;
}

interface MonthlySavingsGraphProps {
  userId: string;
}

export default function MonthlySavingsGraph({ userId }: MonthlySavingsGraphProps) {
  const [interval, setInterval] = useState<Interval>("monthly");
  const [data, setData] = useState<SavingsData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      // Fetch all transactions to calculate cumulative savings
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("amount, type, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        setData([]);
        return;
      }

      // Calculate cumulative savings over time
      let cumulativeSavings = 0;
      const savingsByDate: { [key: string]: number } = {};

      transactions.forEach((transaction: any) => {
        const date = dayjs(transaction.created_at);
        let dateKey = "";

        switch (interval) {
          case "daily":
            dateKey = date.format("YYYY-MM-DD");
            break;
          case "weekly":
            dateKey = `Week ${date.isoWeek()}`;
            break;
          case "monthly":
            dateKey = date.format("YYYY-MM");
            break;
          case "yearly":
            dateKey = date.format("YYYY");
            break;
        }

        if (transaction.type === "allowance") {
          const savingsFromTransaction = Number(transaction.amount) * 0.2;
          cumulativeSavings += savingsFromTransaction;
        } else if (transaction.type === "unlock") {
          cumulativeSavings -= Number(transaction.amount);
        }

        // Store the cumulative savings for this date period
        savingsByDate[dateKey] = cumulativeSavings;
      });

      // Format the data for the chart
      const formattedData: SavingsData[] = Object.entries(savingsByDate).map(([date, amount]) => {
        let xLabel = date;
        
        // Format the x-axis label nicely
        if (interval === "weekly") {
          const weekNumber = date.replace("Week ", "");
          xLabel = `Week ${weekNumber}`;
        } else if (interval === "monthly") {
          const [year, month] = date.split("-");
          xLabel = dayjs(`${year}-${month}-01`).format("MMMM YYYY");
        }

        return { x: xLabel, y: Number(amount.toFixed(2)) };
      });

      setData(formattedData);
    } catch (err) {
      console.error("Error fetching graph data:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userId, interval]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Savings Growth Over Time</h3>
        <div className="flex space-x-2">
          {(["daily", "weekly", "monthly", "yearly"] as Interval[]).map((intv) => (
            <button
              key={intv}
              onClick={() => setInterval(intv)}
              className={`px-3 py-1 rounded-lg font-medium transition-colors duration-200 ${
                interval === intv
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {intv.charAt(0).toUpperCase() + intv.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-pulse w-full bg-gray-200 h-full rounded"></div>
        </div>
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-600">No savings data available yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" />
            <YAxis />
            <Tooltip 
              formatter={(value: number) => [`$${value.toFixed(2)}`, "Savings"]}
              labelFormatter={(label) => `Period: ${label}`}
            />
            <Line 
              type="monotone" 
              dataKey="y" 
              stroke="#1D4ED8" 
              strokeWidth={3} 
              dot={{ r: 4 }} 
              activeDot={{ r: 6, fill: "#1D4ED8" }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

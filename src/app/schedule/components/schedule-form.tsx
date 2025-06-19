
"use client";

import type { ScheduleEntry, FeedingFrequency } from "@/lib/types";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, Edit3, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ScheduleFormProps {
  currentSchedule: ScheduleEntry | null;
  onSaveSchedule: (schedule: Omit<ScheduleEntry, 'id' | 'enabled'> & { enabled?: boolean }) => void;
}

const frequencies: FeedingFrequency[] = ["Once a day", "Twice a day", "Thrice a day"];

const defaultTime = "08:00";
const defaultAmountNumber = "5"; // Store as string for input, will append 'g' on save
const defaultFrequency: FeedingFrequency = "Once a day";

export function ScheduleForm({ currentSchedule, onSaveSchedule }: ScheduleFormProps) {
  const { toast } = useToast();
  const [time, setTime] = useState(defaultTime);
  const [amount, setAmount] = useState(defaultAmountNumber); // Input field will store just the number
  const [frequency, setFrequency] = useState<FeedingFrequency>(defaultFrequency);

  const formTitle = currentSchedule ? "Update Active Schedule" : "Set Active Schedule";
  const buttonText = currentSchedule ? "Update Schedule" : "Set Schedule";
  const buttonIcon = currentSchedule ? <Edit3 className="mr-2 h-5 w-5" /> : <PlusCircle className="mr-2 h-5 w-5" />;

  useEffect(() => {
    if (currentSchedule) {
      setTime(currentSchedule.time);
      // Remove 'g' for display in input, if present
      setAmount(currentSchedule.amount.replace(/g$/i, ''));
      setFrequency(currentSchedule.frequency);
    } else {
      setTime(defaultTime);
      setAmount(defaultAmountNumber);
      setFrequency(defaultFrequency);
    }
  }, [currentSchedule]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!time || !frequency || !amount) {
      toast({
        title: "Missing Information",
        description: "Please fill in time, select frequency, and specify amount.",
        variant: "destructive",
      });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Food amount must be a positive number.",
        variant: "destructive",
      });
      return;
    }

    const scheduleDataToSave: Omit<ScheduleEntry, 'id' | 'enabled'> & { enabled?: boolean } = {
      time,
      frequency,
      amount: `${numericAmount}g`, // Append 'g' before saving
    };
    if (currentSchedule) {
        scheduleDataToSave.enabled = currentSchedule.enabled;
    }

    onSaveSchedule(scheduleDataToSave);
  };

  return (
    <Card className="mb-6 border-primary/50 shadow-md">
      <CardHeader>
        <CardTitle className="font-headline text-xl flex items-center gap-2 text-primary">
          <Settings className="h-6 w-6" /> 
          {formTitle}
        </CardTitle>
        <CardDescription>
          {currentSchedule ? "Modify the active feeding schedule." : "Configure the active feeding schedule for your fish."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="time" className="font-medium">Time for first meal</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="frequency" className="font-medium">Feeding Frequency</Label>
              <Select value={frequency} onValueChange={(value) => setFrequency(value as FeedingFrequency)}>
                <SelectTrigger id="frequency" className="mt-1">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {frequencies.map((freq) => (
                    <SelectItem key={freq} value={freq}>{freq}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="amount" className="font-medium">Food Amount (grams)</Label>
              <Input
                id="amount"
                type="text" // Keep as text to allow flexible input, parse to number later
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g., 5"
                className="mt-1"
                required
              />
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row gap-2">
            <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
              {buttonIcon}
              {buttonText}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

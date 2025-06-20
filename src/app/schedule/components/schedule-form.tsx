
"use client";

import type { ScheduleEntry, FeedingFrequency } from "@/lib/types";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, Edit3, Settings, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ScheduleFormProps {
  currentSchedule: ScheduleEntry | null;
  onSaveSchedule: (schedule: Omit<ScheduleEntry, 'id' | 'enabled'> & { enabled?: boolean }) => void;
}

const frequencies: FeedingFrequency[] = ["Once a day", "Twice a day", "Thrice a day"];
const DEFAULT_INTERVAL_CHOICE = "auto";

const defaultTime = "08:00";
const defaultAmountNumber = "15"; // Default total daily amount
const defaultFrequency: FeedingFrequency = "Once a day";

interface IntervalOption {
  value: string;
  label: string;
}

export function ScheduleForm({ currentSchedule, onSaveSchedule }: ScheduleFormProps) {
  const { toast } = useToast();
  const [time, setTime] = useState(defaultTime); // Time for first meal
  const [amount, setAmount] = useState(defaultAmountNumber); // Total daily amount
  const [frequency, setFrequency] = useState<FeedingFrequency>(defaultFrequency);
  const [intervalChoice, setIntervalChoice] = useState<string>(DEFAULT_INTERVAL_CHOICE);

  const formTitle = currentSchedule ? "Update Active Schedule" : "Set Active Schedule";
  const buttonText = currentSchedule ? "Update Schedule" : "Set Schedule";
  const buttonIcon = currentSchedule ? <Edit3 className="mr-2 h-5 w-5" /> : <PlusCircle className="mr-2 h-5 w-5" />;

  useEffect(() => {
    if (currentSchedule) {
      setTime(currentSchedule.time);
      setAmount(currentSchedule.amount.replace(/g$/i, ''));
      setFrequency(currentSchedule.frequency);
      setIntervalChoice(currentSchedule.intervalChoice || DEFAULT_INTERVAL_CHOICE);
    } else {
      setTime(defaultTime);
      setAmount(defaultAmountNumber);
      setFrequency(defaultFrequency);
      setIntervalChoice(DEFAULT_INTERVAL_CHOICE);
    }
  }, [currentSchedule]);

  const intervalOptions = useMemo((): IntervalOption[] => {
    if (frequency === "Once a day") {
      return [{ value: "auto", label: "N/A (Once a day)" }];
    }
    if (frequency === "Twice a day") {
      return [
        { value: "auto", label: "Auto (Evenly Split - 12h)" },
        { value: "6", label: "6 hours" },
        { value: "8", label: "8 hours" },
        { value: "10", label: "10 hours" },
      ];
    }
    if (frequency === "Thrice a day") {
      return [
        { value: "auto", label: "Auto (Evenly Split - 8h)" },
        { value: "4", label: "4 hours" },
        { value: "6", label: "6 hours" },
      ];
    }
    return [{ value: "auto", label: "Auto (Evenly Split)" }];
  }, [frequency]);

  useEffect(() => {
    // Reset interval choice if frequency changes and current interval is no longer valid or optimal
    if (frequency === "Once a day") {
        setIntervalChoice("auto");
    } else {
        const currentOptionValues = intervalOptions.map(opt => opt.value);
        if (!currentOptionValues.includes(intervalChoice)) {
            setIntervalChoice(DEFAULT_INTERVAL_CHOICE); // Reset to auto if current choice is not in new options
        }
    }
  }, [frequency, intervalChoice, intervalOptions]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!time || !frequency || !amount) {
      toast({
        title: "Missing Information",
        description: "Please fill in time, select frequency, and specify total daily amount.",
        variant: "destructive",
      });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Total daily food amount must be a positive number.",
        variant: "destructive",
      });
      return;
    }

    const scheduleDataToSave: Omit<ScheduleEntry, 'id' | 'enabled'> & { enabled?: boolean } = {
      time,
      frequency,
      amount: `${numericAmount}g`,
      intervalChoice: frequency === "Once a day" ? "auto" : intervalChoice,
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
          <br />
          The system will calculate individual feeding times and amounts based on your settings.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
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
              <Label htmlFor="intervalChoice" className="font-medium">Interval Between Feeds</Label>
              <Select
                value={intervalChoice}
                onValueChange={(value) => setIntervalChoice(value)}
                disabled={frequency === "Once a day"}
              >
                <SelectTrigger id="intervalChoice" className="mt-1">
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  {intervalOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="amount" className="font-medium">Total Daily Food Amount (grams)</Label>
              <Input
                id="amount"
                type="text" // Changed to text to allow for "g" if user types it, validation handles numeric part
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} // Allow only numbers and dot
                placeholder="e.g., 15"
                className="mt-1"
                required
              />
            </div>
          </div>
           {frequency === "Thrice a day" && intervalChoice === "6" && (
            <div className="mt-2 flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 p-3 rounded-md border border-yellow-300">
                <AlertTriangle className="h-5 w-5"/>
                With 3 feedings and a 6-hour interval, the last feeding might be close to the first. Consider 'Auto' or a 4-hour interval for more even spacing.
            </div>
            )}


          <div className="flex flex-col md:flex-row gap-2 pt-2">
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

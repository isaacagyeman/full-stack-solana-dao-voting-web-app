import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export function CountdownTimer({ endTime }: { endTime: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculate = () => {
      const end = new Date(endTime).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("Ended");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      else if (hours > 0) setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      else setTimeLeft(`${minutes}m ${seconds}s`);
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [endTime]);

  return (
    <span className="flex items-center gap-1.5 text-sm text-muted-foreground font-mono">
      <Clock className="w-3.5 h-3.5" />
      {timeLeft}
    </span>
  );
}

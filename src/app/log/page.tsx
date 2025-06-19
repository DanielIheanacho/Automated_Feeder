
"use client";

import { LogViewer } from "./components/log-viewer";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListChecks, LogIn } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

export default function LogPage() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="shadow-lg text-center">
        <CardHeader>
          <ListChecks className="h-12 w-12 text-primary mx-auto mb-4" />
          <CardTitle className="font-headline text-3xl text-primary">Access Denied</CardTitle>
          <CardDescription className="text-md text-foreground/80">
            Please log in to view the feeding log.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" passHref>
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <LogIn className="mr-2 h-5 w-5" /> Go to Login
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
       <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <ListChecks className="h-8 w-8 text-primary" />
            <CardTitle className="font-headline text-3xl text-primary">Feeding Log</CardTitle>
          </div>
          <CardDescription className="text-md text-foreground/80">
            Review past feeding activity and system events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogViewer />
        </CardContent>
      </Card>
    </div>
  );
}

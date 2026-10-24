import { useLocation, Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Mail } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { supabaseClient } from "@/config/supabase-client";

const EmailVerificationPage = () => {
  const location = useLocation();
  const email = location.state?.email || "your email";
  const [isResending, setIsResending] = useState(false);
  const toastShownRef = useRef(false);

  // Send initial toast notification only once
  useEffect(() => {
    if (!toastShownRef.current) {
      toast.success("Verification email sent! Please check your inbox.", {
        description: `We've sent an email to ${email}`,
        duration: 5000,
      });
      toastShownRef.current = true;
    }
  }, [email]);

  const handleResendEmail = async () => {
    if (!email || email === "your email") {
      toast.error("Email address not available");
      return;
    }

    setIsResending(true);
    try {
      const { error } = await supabaseClient.auth.resend({
        type: 'signup',
        email,
      });
      
      if (error) {
        toast.error("Failed to resend verification email", {
          description: error.message,
        });
      } else {
        toast.info("Verification email resent", {
          description: "Please check your inbox and spam folder",
        });
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-[350px] shadow-lg">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Verify your email</CardTitle>
          <CardDescription className="text-center">
            We've sent a verification link to {email}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          <p>
            Please check your email and click the verification link to continue.
          </p>
          <p className="mt-2 text-sm">
            After verifying your email, you can return to sign in.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <Button 
            variant="outline" 
            className="w-full"
            onClick={handleResendEmail}
            disabled={isResending}
          >
            {isResending ? "Sending..." : "Resend Email"}
          </Button>
          <Button asChild className="w-full">
            <Link to="/">Return to Login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default EmailVerificationPage;
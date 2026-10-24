import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
  } from "@/components/ui/form";
import { SignInFlow } from "@/lib/types";
import { supabaseClient } from "@/config/supabase-client";
import { Github, Mail } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Separator } from "../ui/separator";
import { useState } from "react";

const formSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

interface SignInCardProps {
    setState: (state: SignInFlow) => void;
}

type FormValues = z.infer<typeof formSchema>;


const SignInCard = ({ setState }: SignInCardProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSocialLoading, setIsSocialLoading] = useState<string | null>(null);
    const navigate = useNavigate();
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });


    const onSubmit = async (values: FormValues) => {
        setIsLoading(true);
        
        const promise = supabaseClient.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        }).then(({ error }) => {
          if (error) throw new Error(error.message);
          navigate("/dashboard");
        });
    
        toast.promise(promise, {
          loading: "Signing in...",
          success: "Signed in successfully!",
          error: (err) => `${err.message || "Failed to sign in"}`,
        });
    
        promise.finally(() => setIsLoading(false));
    };

    const handleSocialLogin = async (provider: 'github' | 'google') => {
        setIsSocialLoading(provider);
        try {
          const { error } = await supabaseClient.auth.signInWithOAuth({
            provider
          });
    
          if (error) {
            toast.error(`${error.message || `Failed to sign in with ${provider}`}`);
          }
          // No success toast here as we're redirecting away
        } catch (err) {
          toast.error(`An error occurred during ${provider} sign in`);
        } finally {
          setIsSocialLoading(null);
        }
      };

    return (
        <Card className="w-[350px] shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button 
              type="button" 
              variant="outline" 
              className="w-full"
              disabled={isLoading || isSocialLoading !== null}
              onClick={() => handleSocialLogin('github')}
            >
              {isSocialLoading === 'github' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Github className="mr-2 h-4 w-4" />
              )}
              Continue with GitHub
            </Button>

            <Button 
            type="button" 
            variant="outline" 
            className="w-full"
            disabled={isLoading || isSocialLoading !== null}
            onClick={() => handleSocialLogin('google')}
          >
            {isSocialLoading === 'google' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
              </svg>
            )}
            Continue with Google
          </Button>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="you@example.com" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
        <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading || isSocialLoading !== null}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Sign In with Email
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col">
        <div className="mt-2 text-center text-sm">
          Don't have an account?{" "}
          <Button variant="link" className="p-0" onClick={() => setState("signUp")}>
            Sign up
          </Button>
        </div>
      </CardFooter>
    </Card>
    )
}
export default SignInCard;
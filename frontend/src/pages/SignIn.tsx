import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, LockKeyhole } from "lucide-react";
import axios from "axios";
import { Navbar } from "@/components/Navbar";


export default function SignIn() {
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation() as any;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn({ email, password });
    const dest = location?.state?.from?.pathname ?? "/";
    navigate(dest, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex items-center justify-center flex-1 p-4">
        <Card className="w-full max-w-md border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <LockKeyhole className="w-5 h-5" />
            <CardTitle>Welcome back</CardTitle>
          </div>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...</> : "Sign in"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground mt-4">Don't have an account? <Link to="/signup" className="text-accent hover:underline">Sign up</Link></p>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

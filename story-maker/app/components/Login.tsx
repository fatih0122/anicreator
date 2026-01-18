import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import BeeLogo from "../imports/BeeLogo-2-51";
import { ArrowRight, Mail, Lock, AlertCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Attempt to login
    const success = login(email, password);

    if (success) {
      // Redirect to create page on successful login
      router.push('/create/start');
    } else {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/50 via-white to-pink-50/30 flex items-center justify-center py-12 px-6">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-6">
            <BeeLogo />
          </div>
          <h1 className="text-[#6D14EC] mb-3">
            Stobee에 오신 것을 환영합니다
          </h1>
          <p className="text-gray-600">
            로그인하여 AI 스토리 메이커를 시작하세요
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-800">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">
                이메일
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-11 h-12 rounded-xl border-gray-200 focus:border-[#6D14EC] focus:ring-[#6D14EC]"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-gray-700">
                비밀번호
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-11 h-12 rounded-xl border-gray-200 focus:border-[#6D14EC] focus:ring-[#6D14EC]"
                  required
                />
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox className="data-[state=checked]:bg-[#6D14EC] data-[state=checked]:border-[#6D14EC]" />
                <span className="text-sm text-gray-600">로그인 상태 유지</span>
              </label>
              <a
                href="#"
                className="text-sm text-[#6D14EC] hover:text-[#5a0fc7] transition-colors"
              >
                비밀번호 찾기
              </a>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#6D14EC] hover:bg-[#5a0fc7] text-white rounded-full h-12 shadow-lg hover:shadow-xl transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "로그인 중..." : "로그인"}
              {!isLoading && <ArrowRight className="ml-2 w-5 h-5" />}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">또는</span>
            </div>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 rounded-xl border-gray-200 hover:bg-gray-50 transition-all"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google로 계속하기
            </Button>
            
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 rounded-xl border-gray-200 hover:bg-gray-50 transition-all"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" />
              </svg>
              Facebook으로 계속하기
            </Button>
          </div>

          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              계정이 없으신가요?{" "}
              <a
                href="#"
                className="text-[#6D14EC] hover:text-[#5a0fc7] transition-colors"
              >
                회원가입
              </a>
            </p>
          </div>
        </div>

        {/* Terms and Privacy */}
        <div className="mt-6 text-center text-sm text-gray-500">
          로그인하면{" "}
          <a href="#" className="text-[#6D14EC] hover:underline">
            이용약관
          </a>{" "}
          및{" "}
          <a href="#" className="text-[#6D14EC] hover:underline">
            개인정보처리방침
          </a>
          에 동의하는 것으로 간주됩니다.
        </div>
      </div>
    </div>
  );
}

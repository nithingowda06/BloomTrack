import { User, LogOut, Users, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const handleSignOut = async () => {
    await authApi.signOut();
    toast.success("Signed out successfully");
    window.location.reload();
  };
  
  return (
    <header className="w-full">
      <div
        className="w-full bg-gradient-to-r from-[#6C4ACF] via-[#6C4ACF] to-[#20C6B7] text-white shadow-md"
      >
        <div className="mx-auto max-w-7xl px-4 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
                {/* simple logo mark */}
                <span className="text-xl font-extrabold leading-none">🪴</span>
              </div>
              <div className="leading-tight">
                <div className="text-lg md:text-xl font-semibold">BloomTrack</div>
                <div className="text-xs md:text-sm text-white/85">BloomTrack</div>
              </div>
            </div>
            
            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-2 ml-6">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/')}
                className={`text-white hover:bg-white/20 gap-2 ${location.pathname === '/' ? 'bg-white/20' : ''}`}
              >
                <Home className="h-4 w-4" />
                Home
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/all-sellers')}
                className={`text-white hover:bg-white/20 gap-2 ${location.pathname === '/all-sellers' ? 'bg-white/20' : ''}`}
              >
                <Users className="h-4 w-4" />
                All Sellers
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center shadow-md">
              <User className="h-5 w-5 text-white" />
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleSignOut}
              className="text-white hover:bg-white/20 gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

import { useEffect, useState } from "react";
import { User, LogOut, Users, Home, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authApi, profileApi } from "@/lib/api";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  
  const handleSignOut = async () => {
    await authApi.signOut();
    toast.success("Signed out successfully");
    window.location.reload();
  };

  const loadProfile = async () => {
    setLoadingProfile(true);
    try {
      const data = await profileApi.get();
      setProfile(data || null);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load profile");
    } finally {
      setLoadingProfile(false);
    }
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
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/payments')}
                className={`text-white hover:bg-white/20 gap-2 ${location.pathname === '/payments' ? 'bg-white/20' : ''}`}
              >
                <CreditCard className="h-4 w-4" />
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setIsProfileOpen(true); loadProfile(); }}
              className="h-10 w-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center shadow-md focus:outline-none focus:ring-2 focus:ring-white/50"
              aria-label="Open profile"
            >
              <User className="h-5 w-5 text-white" />
            </button>
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
      {/* Profile Dialog */}
      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Shop Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {loadingProfile ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground">Shop Name</div>
                  <div className="text-sm font-medium">{profile?.shop_name || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Owner</div>
                  <div className="text-sm font-medium">{profile?.owner_name || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Mobile</div>
                  <div className="text-sm font-medium">{profile?.mobile || '-'}</div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}

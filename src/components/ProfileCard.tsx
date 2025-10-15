import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, User, Phone } from "lucide-react";

interface ProfileCardProps {
  profile: {
    owner_name: string;
    mobile: string;
    shop_name: string;
  };
}

export const ProfileCard = ({ profile }: ProfileCardProps) => {
  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="w-5 h-5 text-primary" />
          Shop Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Store className="w-5 h-5" />
            </span>
            <div>
              <div className="text-xs text-muted-foreground">Shop Name</div>
              <div className="font-medium text-foreground">{profile.shop_name}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="w-5 h-5" />
            </span>
            <div>
              <div className="text-xs text-muted-foreground">Owner</div>
              <div className="font-medium text-foreground">{profile.owner_name}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Phone className="w-5 h-5" />
            </span>
            <div>
              <div className="text-xs text-muted-foreground">Mobile</div>
              <div className="font-medium text-foreground">{profile.mobile}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

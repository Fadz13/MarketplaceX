"use client";

import { useState } from "react";
import { AvatarUpload } from "@/components/account/avatar-upload";
import { ProfileForm } from "@/components/account/profile-form";
import type { Profile } from "@/lib/actions/profile";

type Props = {
  profile: Profile & { email: string };
};

export function ProfileContent({ profile }: Props) {
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);

  return (
    <div className="space-y-6">
      <AvatarUpload avatarUrl={avatarUrl} onAvatarChange={setAvatarUrl} />
      <ProfileForm profile={{ ...profile, avatar_url: avatarUrl }} />
    </div>
  );
}

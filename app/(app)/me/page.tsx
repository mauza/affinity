"use client";
import { useState } from "react";
import ProfileEditor from "@/components/ui/profile";
import Tables from "@/components/ui/tables";
export default function Me() {
  const [profileRevision, setProfileRevision] = useState(0);
  return (
    <>
      <ProfileEditor onSaved={() => setProfileRevision(v => v + 1)} />
      <Tables alertsOnly profileRevision={profileRevision} />
    </>
  );
}

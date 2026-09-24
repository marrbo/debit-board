// components/UserAvatar.tsx
"use client";

import Image from "next/image";
import { User2 } from "lucide-react";
import { useSession } from "next-auth/react";

interface UserAvatarProps {
  size?: number;
  shape?: "square" | "circle";
  className?: string;
  alt?: string;
}

export default function UserAvatar({
  size = 40,
  shape = "square",
  className = "",
  alt,
}: UserAvatarProps) {
  const { data: session, status } = useSession();
  const name = session?.user?.name;

  const roundedClass = shape === "circle" ? "rounded-full" : "rounded-md";

  // Skeleton enquanto a sessão carrega
  if (status === "loading") {
    return (
      <div
        className={`animate-pulse bg-surface border border-default shrink-0 ${roundedClass} ${className}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  // Sem usuário — fallback
  if (!name) {
    return (
      <div
        className={`flex items-center justify-center bg-surface border border-default shrink-0 ${roundedClass} ${className}`}
        style={{ width: size, height: size }}
      >
        <User2
          className="text-muted"
          style={{ width: size * 0.6, height: size * 0.6 }}
        />
      </div>
    );
  }

  const url = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name,
  )}&rounded=false&length=2&background=0056b3&color=fff&bold=true&uppercase=true&width=${size * 2}&height=${size * 2}`;

  return (
    <Image
      src={url}
      width={size}
      height={size}
      loading="eager"
      className={`object-cover shrink-0 ${roundedClass} ${className}`}
      style={{ width: size, height: size }}
      alt={alt ?? name}
    />
  );
}

"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Clock,
  Film,
  ImageIcon,
  LayoutDashboard,
  Library,
  MessageSquare,
  Package,
  Sparkles, // ✅ Added for Effects
} from "lucide-react";

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  label,
  isActive,
  onClick,
}) => {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    setClicked(true);
    onClick();
    setTimeout(() => setClicked(false), 200);
  };

  return (
    <div
      className={`
        flex flex-col items-center justify-center cursor-pointer p-2 rounded-2xl
        transition-all duration-300 ease-in-out
        w-16 m-1 text-xs
        ${isActive
          ? "bg-white text-black font-semibold shadow-md ring-1 ring-black/10"
          : "bg-transparent text-muted-foreground hover:bg-gray-100 hover:text-black"}
        ${clicked ? "scale-105" : ""}
      `}
      onClick={handleClick}
    >
      <div
        className={`transition-transform duration-200 ${
          clicked ? "animate-bounce-sm" : ""
        }`}
      >
        {React.cloneElement(icon as React.ReactElement)}
      </div>
      <span className="mt-1 text-[11px] font-medium truncate w-full text-center">
        {label}
      </span>
    </div>
  );
};

interface SidebarProps {
  onPageChange: (page: string) => void;
  activePage?: string;
}

const Sidebar = React.forwardRef<any, SidebarProps>(
  ({ onPageChange, activePage = "Dashboard" }, ref) => {
    const [activeNav, setActiveNav] = useState(activePage);

    useEffect(() => {
      setActiveNav(activePage);
    }, [activePage]);

    React.useImperativeHandle(ref, () => ({
      setActivePage: (page: string) => setActiveNav(page),
    }));

    const handleClick = (page: string) => {
      setActiveNav(page);
      onPageChange(page);
    };

    const menuItems = [
      { icon: <LayoutDashboard />, label: "Dashboard", path: "/" },
      { icon: <Clock />, label: "Timeline" },
      { icon: <Sparkles />, label: "Effects" }, // ✅ New Effects item
      { icon: <Library />, label: "Media", path: "/media" },
      { icon: <ImageIcon />, label: "Images" }, // ✅ Images section
      { icon: <Film />, label: "Videos" }, // ✅ Videos section
      { icon: <MessageSquare />, label: "Captions" },
      { icon: <Package />, label: "Export" },
    ];

    return (
      <div className="shadow-md">
        <div
          className="flex flex-col items-center space-y-2 py-2 pb-10 h-screen overflow-y-auto w-[80px]
          [&::-webkit-scrollbar]:w-1
          [&::-webkit-scrollbar-track]:bg-gray-100
          [&::-webkit-scrollbar-thumb]:bg-gray-300
          dark:[&::-webkit-scrollbar-track]:bg-neutral-700
          dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500"
        >
          {menuItems.map((item) => {
            const content = (
              <SidebarItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                isActive={activeNav === item.label}
                onClick={() => handleClick(item.label)}
              />
            );

            return item.path ? (
              <Link href={item.path} key={item.label}>
                {content}
              </Link>
            ) : (
              <div key={item.label}>{content}</div>
            );
          })}
        </div>
      </div>
    );
  }
);

Sidebar.displayName = "Sidebar";
export default Sidebar;

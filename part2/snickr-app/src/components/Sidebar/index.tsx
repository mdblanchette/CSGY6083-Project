"use client";

import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import SidebarItem from "@/components/Sidebar/SidebarItem";
import ClickOutside from "@/components/ClickOutside";
import useLocalStorage from "@/hooks/useLocalStorage";

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (arg: boolean) => void;
}

const menuGroups: any[] = [];

const Sidebar = ({ sidebarOpen, setSidebarOpen }: SidebarProps) => {
  const pathname = usePathname();

  const [pageName, setPageName] = useLocalStorage("selectedMenu", "dashboard");

  return (
    <ClickOutside onClick={() => setSidebarOpen(false)}>
      <aside
        className={`absolute left-0 top-0 z-9999 flex h-screen w-72.5 flex-col overflow-y-hidden border-r border-stroke bg-white dark:border-stroke-dark dark:bg-gray-dark lg:static lg:translate-x-0 ${
          sidebarOpen
            ? "translate-x-0 duration-300 ease-linear"
            : "-translate-x-full"
        }`}
      >
        {/* <!-- SIDEBAR HEADER --> */}
        <div className="flex items-center justify-between gap-2 border-b border-stroke px-6 py-5.5 dark:border-stroke-dark lg:py-6.5 xl:py-10">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">💬</span>
            <span className="text-heading-4 font-bold text-dark dark:text-white">
              Snickr
            </span>
          </Link>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen(!sidebarOpen);
            }}
            className="block lg:hidden"
          >
            <svg
              className="fill-current"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M4.41421 6.41421C4.02369 6.02369 3.37631 6.02369 2.98579 6.41421C2.59526 6.80474 2.59526 7.45211 2.98579 7.84264L8.1421 13C8.53236 13.3905 9.17053 13.3905 9.56079 13L14.7171 7.84264C15.1076 7.45211 15.1076 6.80474 14.7171 6.41421C14.3266 6.02369 13.6792 6.02369 13.2887 6.41421L9.35144 10.3515L5.41421 6.41421Z"
                fill=""
              />
            </svg>
          </button>
        </div>
        {/* <!-- SIDEBAR HEADER --> */}

        <div className="border-b border-stroke px-6 py-5 dark:border-stroke-dark">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-medium text-white transition hover:bg-primary/90"
          >
            <svg
              className="fill-current"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9.00001 2.0625C9.31067 2.0625 9.56251 2.31434 9.56251 2.625V8.4375H15.375C15.6857 8.4375 15.9375 8.68934 15.9375 9C15.9375 9.31066 15.6857 9.5625 15.375 9.5625H9.56251V15.375C9.56251 15.6857 9.31067 15.9375 9.00001 15.9375C8.68934 15.9375 8.43751 15.6857 8.43751 15.375V9.5625H2.62501C2.31435 9.5625 2.06251 9.31066 2.06251 9C2.06251 8.68934 2.31435 8.4375 2.62501 8.4375H8.43751V2.625C8.43751 2.31434 8.68935 2.0625 9.00001 2.0625Z"
                fill=""
              />
            </svg>
            Create Workspace
          </button>
        </div>

        <div className="no-scrollbar flex flex-col overflow-y-auto duration-300 ease-linear">
          {/* <!-- MENU GROUPS --> */}
          {menuGroups.map((group, groupIndex) => (
            <nav key={groupIndex} className="mt-4 px-4 py-4.5 lg:mt-9 lg:px-6">
              <h3 className="mb-4 ml-4 text-sm font-medium text-dark-4 dark:text-dark-6">
                {group.name}
              </h3>

              <ul className="mb-6 flex flex-col gap-1.5">
                {group.menuItems.map((menuItem: any, menuItemIndex: number) => (
                  <SidebarItem
                    key={menuItemIndex}
                    item={menuItem}
                    pageName={pageName}
                    setPageName={setPageName}
                    pathname={pathname}
                  />
                ))}
              </ul>
            </nav>
          ))}
          {/* <!-- MENU GROUPS --> */}
        </div>
      </aside>
    </ClickOutside>
  );
};

export default Sidebar;

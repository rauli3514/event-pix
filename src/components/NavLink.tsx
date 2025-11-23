import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface NavLinkProps {
    to: string;
    children: React.ReactNode;
    className?: string;
}

export const NavLink = ({ to, children, className }: NavLinkProps) => {
    const location = useLocation();
    const isActive = location.pathname === to;

    return (
        <Link
            to={to}
            className={cn(
                "relative px-4 py-2 text-sm font-medium transition-colors hover:text-primary",
                isActive ? "text-primary" : "text-muted-foreground",
                className
            )}
        >
            {children}
            {isActive && (
                <span className="absolute -bottom-1 left-0 h-0.5 w-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
            )}
        </Link>
    );
};

import type { ReactNode } from "react";

type Props = {
	title: string;
	icon?: ReactNode;
	actions?: ReactNode;
	trailing?: ReactNode;
};

export function Navbar({ title, icon, actions, trailing }: Props) {
	return (
		<header className="sticky top-0 z-10 bg-charcoal border-b border-surface px-4 py-3 flex items-center gap-3">
			<div className="flex items-center gap-2 text-lg">
				{icon && <div className="flex-shrink-0 [&_img]:h-[1lh] [&_img]:w-auto">{icon}</div>}
				<h1 className="font-semibold text-bone truncate">{title}</h1>
			</div>
			{actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
			{trailing && (
				<div className={`flex items-center ${actions ? "" : "ml-auto"}`}>
					{trailing}
				</div>
			)}
		</header>
	);
}

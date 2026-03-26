import { useEffect, useState } from "react";

export default function App() {
	const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
	const [messages, setMessages] = useState<string[]>([]);

	useEffect(() => {
		const ws = new WebSocket(`ws://${window.location.host}/api/ws`);

		ws.onopen = () => setStatus("connected");
		ws.onclose = () => setStatus("disconnected");
		ws.onmessage = (e) => setMessages((prev) => [...prev, e.data]);

		ws.onopen = () => {
			setStatus("connected");
			ws.send("hello from web");
		};

		return () => ws.close();
	}, []);

	return (
		<div className="min-h-screen flex flex-col items-center justify-center gap-4">
			<h1 className="text-4xl font-bold">Hello from Mantle</h1>
			<p>WebSocket: {status}</p>
			<ul>
				{messages.map((msg, i) => (
					<li key={i}>{msg}</li>
				))}
			</ul>
		</div>
	);
}

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Haxworks — Coming soon" }],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="grid min-h-screen place-items-center bg-black px-6 text-white">
      <div className="text-center">
        <p className="text-sm font-extrabold tracking-[0.28em]">HAXWORKS</p>
        <h1 className="mt-4 text-[clamp(3.5rem,12vw,8.5rem)] leading-none font-semibold tracking-tight">
          Coming soon
        </h1>
        <a
          className="mt-8 inline-block rounded-full bg-white px-5 py-3 text-sm font-semibold text-black"
          href="/site-file"
          download="haxworks-cloudflare.zip"
        >
          Download the site file
        </a>
      </div>
    </main>
  );
}

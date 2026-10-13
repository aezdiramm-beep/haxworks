import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

export const Route = createFileRoute("/shop")({ component: Home });

const FIGURES = [
  {
    id: "classic",
    size: "4",
    label: "4-inch",
    name: "Classic Custom Figure",
    blurb: "A compact collectible for desks, shelves, and personal gifts.",
    image: "/images/figure-classic.jpg",
  },
  {
    id: "super",
    size: "6",
    label: "6-inch",
    name: "Super Custom Figure",
    blurb: "A larger figure with more room for recognizable details.",
    image: "/images/figure-super.jpg",
  },
  {
    id: "jumbo",
    size: "10",
    label: "10-inch",
    name: "Jumbo Custom Figure",
    blurb: "The display piece for your favorite person or original character.",
    image: "/images/figure-jumbo.jpg",
  },
] as const;

const FILTERS = [
  { id: "all", label: "All figures" },
  { id: "4", label: "4-inch" },
  { id: "6", label: "6-inch" },
  { id: "10", label: "10-inch" },
] as const;

function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [studioOpen, setStudioOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const visible = useMemo(
    () => FIGURES.filter((figure) => filter === "all" || figure.size === filter),
    [filter],
  );

  function openStudio() {
    setSent(false);
    setStudioOpen(true);
    setMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-2 text-xs sm:px-8">
        <span>Custom figures, made to order</span>
        <a href="#studio" className="underline underline-offset-2" onClick={openStudio}>
          Create your own figure
        </a>
      </div>

      <header className="sticky top-0 z-30 border-b border-transparent bg-paper/95 backdrop-blur">
        <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 sm:px-8 lg:grid-cols-[1fr_auto_1fr]">
          <a href="#top" className="text-xl font-extrabold tracking-widest">
            HAXWORKS
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium lg:flex">
            <a href="#shop">Shop</a>
            <a href="#explore">Explore</a>
            <a href="#studio">Imagine Studio</a>
          </nav>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={openStudio}
              className="hidden items-center gap-2 rounded-full border border-ink px-4 py-2 text-sm font-medium hover:bg-ink hover:text-inverse lg:inline-flex"
            >
              Imagine yourself
              <ArrowUpRight className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-full border border-line lg:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {menuOpen ? (
          <nav className="flex flex-col gap-1 border-t border-line px-5 py-3 lg:hidden">
            {[
              ["#shop", "Shop"],
              ["#explore", "Explore"],
              ["#studio", "Imagine Studio"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-2 py-3 text-base"
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </a>
            ))}
            <button type="button" onClick={openStudio} className="mt-1 rounded-full bg-ink px-4 py-3 text-sm text-inverse">
              Imagine yourself
            </button>
          </nav>
        ) : null}
      </header>

      <main id="top">
        <section className="bg-soft" aria-label="Featured figures">
          <img
            src="/images/hero.webp"
            alt="Three custom vinyl figures: a woman in a black jacket, a man in a white hoodie, and a woman in a lavender jacket."
            className="hero-frame w-full"
          />
        </section>

        <section id="explore" className="px-5 py-16 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="mb-5 text-base font-medium">Featured</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <FeatureCard
                image="/images/feature-ink.jpg"
                kicker="Original character"
                title="Characters with attitude."
                onAction={openStudio}
              />
              <FeatureCard
                image="/images/feature-red.jpg"
                kicker="Custom character"
                title="Big personality. Small figure."
                onAction={openStudio}
              />
            </div>
          </div>
        </section>

        <section id="shop" className="px-5 py-8 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-semibold tracking-widest uppercase">Custom figures / made to order</p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-5xl font-extrabold tracking-tight sm:text-6xl">Choose your size.</h2>
              <p className="max-w-xs text-sm leading-relaxed text-muted">
                Pick the scale that fits your shelf and your idea.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Figure sizes">
              {FILTERS.map((item) => {
                const on = filter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setFilter(item.id)}
                    className={
                      on
                        ? "rounded-full bg-ink px-4 py-2 text-sm text-inverse"
                        : "rounded-full border border-line px-4 py-2 text-sm"
                    }
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((figure) => (
                <article key={figure.id}>
                  <div className="relative overflow-hidden bg-lilac">
                    <span className="absolute top-3 left-3 bg-paper px-2 py-1 text-xs font-bold tracking-wider">
                      MADE TO ORDER
                    </span>
                    <img src={figure.image} alt="" className="aspect-square w-full object-cover" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold tracking-tight">
                    {figure.label} {figure.name}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{figure.blurb}</p>
                  <button
                    type="button"
                    onClick={openStudio}
                    className="mt-3 inline-flex items-center gap-1 border-b border-ink pb-0.5 text-sm font-semibold"
                  >
                    View details
                    <ArrowUpRight className="size-4" aria-hidden />
                  </button>
                </article>
              ))}
            </div>
            {visible.length === 0 ? (
              <p className="mt-8 text-sm text-muted">Nothing in that size yet.</p>
            ) : null}
            <p className="mt-8 text-xs text-muted">
              Figures pictured are style concepts. Your custom design and quote are confirmed before production.
            </p>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-5xl font-extrabold tracking-tight sm:text-6xl">Make it yours.</h2>
              <p className="max-w-xs text-sm text-muted">Every order starts with an idea.</p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <Idea
                index="01 / From a photo"
                title="Make it you."
                body="Upload a photo and see a figure concept."
                action="Imagine yours"
                tone="mist"
                onAction={openStudio}
              />
              <Idea
                index="02 / Original idea"
                title="Dream up a character."
                body="Describe the look, outfit, and personality."
                action="Start creating"
                tone="lavender"
                onAction={openStudio}
              />
              <Idea
                index="03 / Have a reference?"
                title="Talk to us."
                body="For detailed or original-character requests, we’ll review the idea with you."
                action="Message Haxworks"
                tone="mist"
                onAction={openStudio}
              />
            </div>
          </div>
        </section>

        <section id="studio" className="mx-5 mb-16 grid overflow-hidden bg-ink text-inverse sm:mx-8 lg:grid-cols-2">
          <div className="flex flex-col justify-end px-6 py-12 sm:px-12">
            <p className="text-xs font-semibold tracking-widest text-line uppercase">The Imagine Studio</p>
            <h2 className="mt-4 max-w-md text-5xl font-semibold tracking-tight sm:text-6xl">
              See it before we make it.
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-line">
              Upload a photo or write a description to explore your custom figure as a visual concept.
            </p>
            <button
              type="button"
              onClick={openStudio}
              className="mt-6 w-fit rounded-full bg-paper px-5 py-3 text-sm font-medium text-ink"
            >
              Start a concept
            </button>
          </div>
          <img
            src="/images/studio.jpg"
            alt="Two custom figures against a purple studio backdrop."
            className="h-80 w-full object-cover object-top lg:h-full"
          />
        </section>
      </main>

      <footer className="flex flex-col gap-2 border-t border-line px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span className="font-extrabold tracking-widest text-ink">HAXWORKS</span>
        <span>Custom figures, made to order.</span>
      </footer>

      {studioOpen ? (
        <StudioDialog
          sent={sent}
          onClose={() => setStudioOpen(false)}
          onSent={() => setSent(true)}
        />
      ) : null}
    </div>
  );
}

function FeatureCard({
  image,
  kicker,
  title,
  onAction,
}: {
  image: string;
  kicker: string;
  title: string;
  onAction: () => void;
}) {
  return (
    <article className="feature-frame relative flex items-end overflow-hidden text-inverse">
      <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="relative z-10 max-w-sm p-8">
        <p className="text-xs font-semibold tracking-widest uppercase">{kicker}</p>
        <h3 className="mt-2 text-4xl font-semibold tracking-tight">{title}</h3>
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink"
        >
          Imagine yours
        </button>
      </div>
    </article>
  );
}

function Idea({
  index,
  title,
  body,
  action,
  tone,
  onAction,
}: {
  index: string;
  title: string;
  body: string;
  action: string;
  tone: "mist" | "lavender";
  onAction: () => void;
}) {
  return (
    <article className={`idea-card flex flex-col p-6 ${tone === "lavender" ? "bg-lavender" : "bg-mist"}`}>
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">{index}</p>
      <h3 className="mt-auto pt-10 text-3xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-xs text-sm leading-relaxed">{body}</p>
      <button type="button" onClick={onAction} className="mt-5 w-fit text-sm font-semibold">
        {action} <span aria-hidden>↗</span>
      </button>
    </article>
  );
}

function StudioDialog({
  sent,
  onClose,
  onSent,
}: {
  sent: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const key = "haxworks-concepts";
    const existing = JSON.parse(localStorage.getItem(key) || "[]") as unknown[];
    existing.push({ ...data, at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(existing));
    onSent();
    event.currentTarget.reset();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-title"
        className="w-full max-w-lg rounded-2xl bg-paper p-6 text-ink shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={onSubmit}
      >
        <h2 id="studio-title" className="text-3xl font-semibold tracking-tight">
          Imagine yourself
        </h2>
        <p className="mt-1 text-sm text-muted">
          Tell us the person or character. Nothing is produced until you approve a concept.
        </p>
        <label className="mt-4 block text-sm font-semibold" htmlFor="name">
          Name
        </label>
        <input id="name" name="name" required className="mt-1 w-full rounded-xl border border-line px-3 py-3 text-sm" />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold" htmlFor="size">
              Size
            </label>
            <select id="size" name="size" className="mt-1 w-full rounded-xl border border-line px-3 py-3 text-sm">
              <option>4-inch classic</option>
              <option>6-inch super</option>
              <option>10-inch jumbo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold" htmlFor="source">
              Starting point
            </label>
            <select id="source" name="source" className="mt-1 w-full rounded-xl border border-line px-3 py-3 text-sm">
              <option>From a photo</option>
              <option>Original idea</option>
              <option>Reference</option>
            </select>
          </div>
        </div>
        <label className="mt-3 block text-sm font-semibold" htmlFor="idea">
          Look, outfit, personality
        </label>
        <textarea
          id="idea"
          name="idea"
          required
          className="mt-1 min-h-24 w-full rounded-xl border border-line px-3 py-3 text-sm"
          placeholder="Messy dark hair, white hoodie, hands in pockets, calm expression."
        />
        {sent ? (
          <p className="mt-3 rounded-xl bg-lavender px-3 py-3 text-sm">
            Concept saved on this device. A studio would send the preview next.
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-full border border-ink px-4 py-2 text-sm">
            Close
          </button>
          <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm text-inverse">
            Send concept
          </button>
        </div>
      </form>
    </div>
  );
}

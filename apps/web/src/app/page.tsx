import Link from "next/link";
import {
  ArrowRight,
  Check,
  Globe2,
  Layers3,
  MapPin,
  MoveUpRight,
} from "lucide-react";
import { Brand } from "@africacod/ui";
export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Link href="/" aria-label="AfricaCod home">
          <Brand />
        </Link>
        <span className="nav-position">Made for the way Africa sells.</span>
        <div className="nav-actions">
          <Link href="/sign-in">Log in</Link>
          <Link className="button button-dark" href="/sign-up">
            Get started <ArrowRight size={16} />
          </Link>
        </div>
      </nav>
      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="tiny-dot" /> LOCAL ROOTS. BORDERLESS AMBITION.
          </p>
          <h1>
            Your business.
            <br />
            More markets.
            <br />
            <em>One home.</em>
          </h1>
          <p className="hero-description">
            Build your cash-on-delivery business across Africa. Bring your
            stores together, choose your markets and manage COD orders from
            confirmation to delivery.
          </p>
          <div className="hero-actions">
            <Link className="button button-green" href="/sign-up">
              Get started <ArrowRight size={18} />
            </Link>
            <span>Built for independent merchants.</span>
          </div>
          <div className="hero-footnote">
            <Check size={15} /> Your stores. Your markets. Your next chapter.
          </div>
        </div>
        <div
          className="hero-art"
          aria-label="Illustration of one store connecting to several African markets"
        >
          <div className="art-grid" />
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <span className="art-label">ILLUSTRATIVE MARKET SETUP</span>
          <div className="continent" />
          <div className="art-store">
            <div className="art-store-icon">
              <Layers3 size={24} />
            </div>
            <div>
              <strong>Example Store</strong>
              <span>One store, many possibilities</span>
            </div>
            <span className="art-store-check">
              <Check size={14} />
            </span>
          </div>
          <div className="market-float float-kenya">
            <span>🇰🇪</span>
            <div>
              <strong>Kenya</strong>
              <small>KES · Your market</small>
            </div>
            <span className="tiny-dot" />
          </div>
          <div className="market-float float-ghana">
            <span>🇬🇭</span>
            <div>
              <strong>Ghana</strong>
              <small>GHS · Your market</small>
            </div>
            <span className="tiny-dot" />
          </div>
          <div className="market-float float-ci">
            <span>🇨🇮</span>
            <div>
              <strong>Côte d’Ivoire</strong>
              <small>XOF · Your market</small>
            </div>
            <span className="tiny-dot" />
          </div>
          <div className="art-bottom">
            <Globe2 size={17} />
            <span>Choose where your business grows.</span>
            <MoveUpRight size={18} />
          </div>
        </div>
      </section>
      <section className="landing-values">
        <div>
          <span className="feature-number">01</span>
          <Layers3 size={22} />
          <h2>A home for every store</h2>
          <p>Keep your brands together under one organization.</p>
        </div>
        <div>
          <span className="feature-number">02</span>
          <MapPin size={22} />
          <h2>Grow on your terms</h2>
          <p>Choose your markets. Add the next one when you’re ready.</p>
        </div>
        <div>
          <span className="feature-number">03</span>
          <Globe2 size={22} />
          <h2>Africa at the center</h2>
          <p>Local currencies and languages, built into each market.</p>
        </div>
      </section>
      <section className="landing-product" aria-label="COD commerce workflow">
        <p className="eyebrow">FROM STOREFRONT TO DELIVERY</p>
        <h2>A clear workflow for cash on delivery.</h2>
        <div className="landing-product-grid">
          {[
            [
              "Multi-market storefronts",
              "Publish products with local prices and currencies. You choose every market.",
            ],
            [
              "Orders and confirmation",
              "Review customer details, record calls and schedule callbacks in one workspace.",
            ],
            [
              "Fulfillment and delivery",
              "Manage manual shipments through delivery or return. ShipCOD production access is still pending.",
            ],
            [
              "Tracking and Analytics",
              "Measure operations from your own order and shipment records. Marketing configuration is available; provider setup and verification are required.",
            ],
          ].map(([title, description]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
        <Link href="/sign-up" className="button button-green">
          Get started <ArrowRight size={18} />
        </Link>
      </section>
      <footer className="landing-footer">
        <Brand />
        <span>Built for your next chapter.</span>
        <span>© {new Date().getFullYear()} AfricaCod</span>
      </footer>
    </main>
  );
}

/**
 * The introduction at the top of the page.
 */

import { ArrowRight, BookOpen } from "lucide-react";

export default function Hero({ onOpenGuide }: { onOpenGuide: () => void }) {
  return (
    <section className="hero" aria-labelledby="page-title">
      <div className="container">
        <h1 id="page-title">
          Close a street in Melbourne&rsquo;s CBD and watch the traffic find another way.
        </h1>
        <p>
          A live traffic simulation of Melbourne&rsquo;s city centre on real streets. Choose how busy it is,
          close a road, and compare the result with normal traffic.
        </p>
        <div className="hero-actions">
          <a className="button dark" href="#workbench">
            Open the simulator <ArrowRight size={16} />
          </a>
          <button className="button outline-dark" onClick={onOpenGuide}>
            <BookOpen size={16} /> Quick guide
          </button>
        </div>
      </div>
    </section>
  );
}

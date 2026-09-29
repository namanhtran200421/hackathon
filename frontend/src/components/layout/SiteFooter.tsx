/**
 * The black footer: what the simulator is, links and credits.
 */

export default function SiteFooter({ onOpenGuide }: { onOpenGuide: () => void }) {
  return (
    <footer className="site-footer">
      <div className="container">
        <div>
          <h2>Melbourne Traffic Lab</h2>
          <p>
            Real streets, made-up traffic and traffic lights. Use it to explore what might happen when a
            street closes. It is not a traffic forecast or a safety assessment.
          </p>
        </div>
        <div>
          <h2>The simulator</h2>
          <ul>
            <li>
              <a href="#workbench">Simulator</a>
            </li>
            <li>
              <button onClick={onOpenGuide}>Quick guide</button>
            </li>
            <li>
              <a href="#compare">Compare with normal traffic</a>
            </li>
          </ul>
        </div>
        <div>
          <h2>Credits</h2>
          <ul>
            <li>
              NetLogo Web (Tortoise), GPL-2.0: <a href="/sim/LICENSE.md">licence</a> ·{" "}
              <a href="https://github.com/NetLogo/Tortoise" target="_blank" rel="noreferrer">
                source
              </a>
            </li>
            <li>
              Map data{" "}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
                © OpenStreetMap contributors
              </a>
            </li>
            <li>Traffic Grid model after Wilensky (2003)</li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

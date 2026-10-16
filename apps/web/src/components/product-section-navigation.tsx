"use client";

import { useEffect, useRef, useState } from "react";

const sections = [
  { id: "product-information", label: "Product details" },
  { id: "market-offers", label: "Markets & pricing" },
  { id: "product-media", label: "Media" },
  { id: "product-variants", label: "Variants" },
  { id: "product-storefront", label: "Storefront" },
];

export function ProductSectionNavigation({
  productStatus = "draft",
  offerCount = 0,
  mediaCount = 0,
  variantCount = 0,
  published = false,
  created = true,
}: {
  productStatus?: string;
  offerCount?: number;
  mediaCount?: number;
  variantCount?: number;
  published?: boolean;
  created?: boolean;
}) {
  const [active, setActive] = useState(sections[0].id);
  const container = useRef<HTMLDivElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const visibleSections = created ? sections : sections.slice(0, 2);
  const index = visibleSections.findIndex((section) => section.id === active);
  const statuses = created
    ? [
        `${productStatus[0].toUpperCase()}${productStatus.slice(1)} product`,
        `${offerCount} saved ${offerCount === 1 ? "offer" : "offers"}`,
        `${mediaCount} ${mediaCount === 1 ? "image" : "images"}`,
        `${variantCount} ${variantCount === 1 ? "variant" : "variants"}`,
        published ? "Published page" : "Draft page",
      ]
    : ["Not saved yet", "Save product first"];

  useEffect(() => {
    const element = container.current;
    const page = element?.closest<HTMLElement>(".product-editor-page");
    if (!element || !page) return;
    const targets = (created ? sections : sections.slice(0, 2))
      .map((section) => document.getElementById(section.id))
      .filter((target): target is HTMLElement => target !== null);
    let frame = 0;
    const update = () => {
      frame = 0;
      const boundary = element.getBoundingClientRect().bottom + 24;
      const positions = targets.map((target) => ({
        target,
        top: target.getBoundingClientRect().top,
      }));
      const reached = positions.filter((position) => position.top <= boundary);
      const last = reached.at(-1) ?? positions[0];
      const selected = reached.find(
        (position) => position.target.id === window.location.hash.slice(1),
      );
      // Media and variants share a row on desktop; retain the chosen anchor.
      const current =
        selected && last && Math.abs(selected.top - last.top) <= 1
          ? selected
          : last;
      if (current) setActive(current.target.id);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const resize = new ResizeObserver(() => {
      page.style.setProperty(
        "--product-nav-height",
        `${Math.ceil(element.getBoundingClientRect().height)}px`,
      );
      schedule();
    });
    resize.observe(element);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    schedule();
    return () => {
      resize.disconnect();
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
      page.style.removeProperty("--product-nav-height");
    };
  }, [created]);

  useEffect(() => {
    const element = navigation.current;
    const link = element?.querySelector<HTMLElement>(`a[href="#${active}"]`);
    if (!element || !link) return;
    const parent = element.getBoundingClientRect();
    const child = link.getBoundingClientRect();
    if (child.left < parent.left)
      element.scrollLeft += child.left - parent.left;
    else if (child.right > parent.right)
      element.scrollLeft += child.right - parent.right;
  }, [active]);

  return (
    <div className="product-section-navigation" ref={container}>
      <div className="product-section-guidance">
        <span>
          Section {index + 1} of {visibleSections.length}
        </span>
        <span>
          {created
            ? "Each section saves separately"
            : "Create the product to unlock offers"}
        </span>
      </div>
      <nav aria-label="Product sections" ref={navigation}>
        {visibleSections.map((section, position) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            aria-current={active === section.id ? "location" : undefined}
          >
            <span className="product-section-label">
              <span aria-hidden="true">{position + 1}</span>
              {section.label}
            </span>
            <small>{statuses[position]}</small>
          </a>
        ))}
      </nav>
    </div>
  );
}

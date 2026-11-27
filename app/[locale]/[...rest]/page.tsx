// Any unknown address inside a language (e.g. /sk/xyz) shows the localized
// "page not found" page with the site header, instead of Next.js's bare
// English 404.
import { notFound } from "next/navigation";

export default function CatchAllNotFound() {
  notFound();
}

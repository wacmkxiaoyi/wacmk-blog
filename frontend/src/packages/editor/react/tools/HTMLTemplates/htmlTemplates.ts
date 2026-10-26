export type HtmlTemplate = {
  id: string;
  nameKey: string;
  nameFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  preview:
    "document" | "hero" | "two-column" | "projects" | "resume" | "namecard";
  html: string;
};

export const HTML_TEMPLATES: HtmlTemplate[] = [
  {
    id: "document",
    nameKey: "editor.htmlTemplate.document.name",
    nameFallback: "Document",
    descriptionKey: "editor.htmlTemplate.document.description",
    descriptionFallback: "A simple article layout",
    preview: "document",
    html: `<!--
  Template: Document
  Instructions:
  1. Replace placeholder text and links with your own content.
  2. Search for "Replace" comments to find each editable area.
  3. Keep styles inline when copying this template into the HTML editor.
-->
<style>
  html, body { width: 100%; margin: 0; padding: 0; }
  * { box-sizing: border-box; }
</style>
<article style="width: 100%; padding: 24px; color: #1f2937; font-family: Arial, sans-serif; line-height: 1.7;">
  <header style="margin-bottom: 24px; border-bottom: 1px solid #e5e7eb;">
    <!-- Replace the category label. -->
    <p style="margin: 0 0 8px; color: #6366f1; font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Category</p>

    <!-- Replace the article title and introduction. -->
    <h1 style="margin: 0 0 16px; font-size: 38px; line-height: 1.2;">Replace with your title</h1>
    <p style="margin: 0 0 24px; color: #6b7280;">Replace with a concise introduction.</p>
  </header>

  <section>
    <!-- Replace this section heading and its article content. -->
    <h2>Section heading</h2>
    <p>Replace this paragraph with your article content.</p>
    <p>Add more sections, images, or links as needed.</p>
  </section>
</article>`,
  },
  {
    id: "hero",
    nameKey: "editor.htmlTemplate.hero.name",
    nameFallback: "Hero feature",
    descriptionKey: "editor.htmlTemplate.hero.description",
    descriptionFallback: "A bold feature introduction",
    preview: "hero",
    html: `<!--
  Template: Hero feature
  Instructions:
  1. Replace placeholder text, button text, and the button URL.
  2. Replace the image placeholder with an <img> element using a local image URL.
  3. Search for "Replace" comments to find each editable area.
-->
<style>
  html, body { width: 100%; margin: 0; padding: 0; }
  * { box-sizing: border-box; }
</style>
<section style="overflow: hidden; border-radius: 24px; background: linear-gradient(135deg, #312e81, #0f766e); color: #ffffff; font-family: Arial, sans-serif;">
  <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 24px; padding: 24px;">
    <div style="flex: 1 1 280px;">
      <!-- Replace the feature category. -->
      <p style="margin: 0 0 12px; color: #c4b5fd; font-size: 14px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">Featured story</p>

      <!-- Replace the headline and summary. -->
      <h1 style="margin: 0 0 18px; font-size: 42px; line-height: 1.15;">Replace with a strong headline</h1>
      <p style="margin: 0 0 28px; color: #d1fae5; font-size: 18px; line-height: 1.65;">Replace with a short summary that explains why this story matters.</p>

      <!-- Replace the button text and href URL. -->
      <a href="https://example.com" style="display: inline-block; padding: 12px 20px; border-radius: 999px; background: #ffffff; color: #312e81; font-weight: 700; text-decoration: none;">Replace button text</a>
    </div>

    <!-- Replace this image placeholder with an <img> element and a local image URL. -->
    <div style="display: grid; flex: 1 1 240px; min-height: 160px; place-items: center; border-radius: 16px; background: #4f46e5; color: #e0e7ff; font-weight: 700;">
      Replace with your image
    </div>
  </div>
</section>`,
  },
  {
    id: "two-column",
    nameKey: "editor.htmlTemplate.twoColumn.name",
    nameFallback: "Two columns",
    descriptionKey: "editor.htmlTemplate.twoColumn.description",
    descriptionFallback: "An image and text story layout",
    preview: "two-column",
    html: `<!--
  Template: Two columns
  Instructions:
  1. Replace the image placeholder with an <img> element using a local image URL.
  2. Replace the category, headline, and paragraph text.
  3. Search for "Replace" comments to find each editable area.
-->
<style>
  html, body { width: 100%; margin: 0; padding: 0; }
  * { box-sizing: border-box; }
</style>
<section style="display: flex; flex-wrap: wrap; overflow: hidden; border: 1px solid #e5e7eb; border-radius: 20px; background: #ffffff; color: #1f2937; font-family: Arial, sans-serif;">
  <!-- Replace this image placeholder with an <img> element and a local image URL. -->
  <div style="display: grid; flex: 1 1 240px; min-height: 180px; place-items: center; background: #dbeafe; color: #1d4ed8; font-weight: 700;">
    Replace with your image
  </div>

  <div style="flex: 1 1 280px; padding: 24px;">
    <!-- Replace the content category. -->
    <p style="margin: 0 0 12px; color: #2563eb; font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Case study</p>

    <!-- Replace the headline and explanatory paragraphs. -->
    <h2 style="margin: 0 0 18px; font-size: 32px; line-height: 1.25;">Replace with your headline</h2>
    <p style="margin: 0 0 16px; line-height: 1.7;">Replace with the main explanation or story.</p>
    <p style="margin: 0; color: #4b5563; line-height: 1.7;">Use this second paragraph for supporting detail, a quote, or an outcome.</p>
  </div>
</section>`,
  },
  {
    id: "projects",
    nameKey: "editor.htmlTemplate.projects.name",
    nameFallback: "Project showcase",
    descriptionKey: "editor.htmlTemplate.projects.description",
    descriptionFallback: "A three-project portfolio grid",
    preview: "projects",
    html: `<!--
  Template: Project showcase
  Instructions:
  1. Replace the section heading and every project card's title, description, and link.
  2. Replace each color block with an <img> element using a local image URL if needed.
  3. Search for "Replace" comments to find each editable area.
-->
<style>
  html, body { width: 100%; margin: 0; padding: 0; }
  * { box-sizing: border-box; }
</style>
<section style="width: 100%; padding: 24px; border-radius: 24px; background: #f8fafc; color: #172554; font-family: Arial, sans-serif;">
  <header style="margin-bottom: 20px;">
    <!-- Replace the section label and heading. -->
    <p style="margin: 0 0 8px; color: #7c3aed; font-size: 14px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Selected work</p>
    <h2 style="margin: 0; font-size: 32px;">Replace with your projects</h2>
  </header>

  <div style="display: flex; flex-wrap: wrap; gap: 18px;">
    <article style="flex: 1 1 190px; overflow: hidden; border-radius: 16px; background: #ffffff; box-shadow: 0 10px 24px rgba(30, 41, 59, 0.1);">
      <!-- Replace this color block with a local project image if needed. -->
      <div style="height: 120px; background: #c4b5fd;"></div>
      <div style="padding: 20px;">
        <!-- Replace the first project's title, description, link text, and href URL. -->
        <h3 style="margin: 0 0 8px;">Project one</h3>
        <p style="margin: 0 0 16px; color: #475569;">Replace with a project description.</p>
        <a href="https://example.com" style="color: #6d28d9; font-weight: 700;">View project</a>
      </div>
    </article>

    <article style="flex: 1 1 190px; overflow: hidden; border-radius: 16px; background: #ffffff; box-shadow: 0 10px 24px rgba(30, 41, 59, 0.1);">
      <!-- Replace this color block with a local project image if needed. -->
      <div style="height: 120px; background: #93c5fd;"></div>
      <div style="padding: 20px;">
        <!-- Replace the second project's title, description, link text, and href URL. -->
        <h3 style="margin: 0 0 8px;">Project two</h3>
        <p style="margin: 0 0 16px; color: #475569;">Replace with a project description.</p>
        <a href="https://example.com" style="color: #6d28d9; font-weight: 700;">View project</a>
      </div>
    </article>

    <article style="flex: 1 1 190px; overflow: hidden; border-radius: 16px; background: #ffffff; box-shadow: 0 10px 24px rgba(30, 41, 59, 0.1);">
      <!-- Replace this color block with a local project image if needed. -->
      <div style="height: 120px; background: #99f6e4;"></div>
      <div style="padding: 20px;">
        <!-- Replace the third project's title, description, link text, and href URL. -->
        <h3 style="margin: 0 0 8px;">Project three</h3>
        <p style="margin: 0 0 16px; color: #475569;">Replace with a project description.</p>
        <a href="https://example.com" style="color: #6d28d9; font-weight: 700;">View project</a>
      </div>
    </article>
  </div>
</section>`,
  },
  {
    id: "resume",
    nameKey: "editor.htmlTemplate.resume.name",
    nameFallback: "Resume",
    descriptionKey: "editor.htmlTemplate.resume.description",
    descriptionFallback: "A professional resume layout",
    preview: "resume",
    html: `<!--
  Template: Resume
  Instructions:
  1. Replace your name, role, contact details, skills, profile, and experience.
  2. Add more experience sections by copying the existing experience section.
  3. Search for "Replace" comments to find each editable area.
-->
<style>
  html, body { width: 100%; margin: 0; padding: 0; }
  * { box-sizing: border-box; }
</style>
<article style="display: flex; flex-wrap: wrap; width: 100%; font-family: Arial, sans-serif; color: #1f2937; border: 1px solid #e5e7eb;">
  <aside style="flex: 1 1 210px; padding: 24px; background: #1e3a5f; color: #ffffff;">
    <!-- Replace your name and professional role. -->
    <h1 style="margin: 0 0 8px; font-size: 32px;">Your name</h1>
    <p style="margin: 0 0 28px; color: #bfdbfe;">Your professional role</p>

    <!-- Replace your contact details. -->
    <h2 style="font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase;">Contact</h2>
    <p style="color: #dbeafe; line-height: 1.7;">
      email@example.com<br />
      +00 000 000 000<br />
      your-site.com
    </p>

    <!-- Replace the skills and specialties. -->
    <h2 style="font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase;">Skills</h2>
    <p style="color: #dbeafe; line-height: 1.7;">
      Replace with your key skills<br />
      and specialties
    </p>
  </aside>

  <main style="flex: 2 1 320px; padding: 24px;">
    <section style="margin-bottom: 30px;">
      <!-- Replace the profile text. -->
      <h2 style="margin: 0 0 12px; color: #1d4ed8;">Profile</h2>
      <p style="margin: 0; line-height: 1.7;">Replace with a concise professional profile.</p>
    </section>

    <section>
      <!-- Replace this experience entry. Duplicate this section for more entries. -->
      <h2 style="margin: 0 0 12px; color: #1d4ed8;">Experience</h2>
      <h3 style="margin: 0 0 4px;">Role title, Company</h3>
      <p style="margin: 0 0 10px; color: #6b7280;">2022 - Present</p>
      <p style="margin: 0; line-height: 1.7;">Replace with your responsibilities and measurable achievements.</p>
    </section>
  </main>
</article>`,
  },
  {
    id: "namecard",
    nameKey: "editor.htmlTemplate.namecard.name",
    nameFallback: "Personal namecard",
    descriptionKey: "editor.htmlTemplate.namecard.description",
    descriptionFallback: "A compact personal introduction",
    preview: "namecard",
    html: `<!--
  Template: Personal namecard
  Instructions:
  1. Replace the avatar placeholder with an <img> element using a local image URL.
  2. Replace your name, role, biography, contact labels, and contact URLs.
  3. Search for "Replace" comments to find each editable area.
-->
<style>
  html, body { width: 100%; margin: 0; padding: 0; }
  * { box-sizing: border-box; }
</style>
<section style="width: 100%; padding: 24px; border-radius: 24px; background: linear-gradient(135deg, #fff7ed, #fdf2f8); color: #3f3f46; font-family: Arial, sans-serif; box-shadow: 0 18px 40px rgba(120, 53, 15, 0.12);">
  <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 24px;">
    <!-- Replace this avatar placeholder with an <img> element and a local image URL. -->
    <div style="display: grid; width: 124px; height: 124px; place-items: center; border-radius: 50%; background: #fed7aa; color: #9a3412; font-size: 13px; font-weight: 700; text-align: center;">
      Replace avatar
    </div>

    <div style="flex: 1 1 240px;">
      <!-- Replace the greeting, name, and role. -->
      <p style="margin: 0 0 6px; color: #c2410c; font-weight: 700;">Hello, I am</p>
      <h1 style="margin: 0 0 8px; font-size: 34px;">Your name</h1>
      <p style="margin: 0; color: #78716c; font-size: 18px;">Your role or tagline</p>
    </div>
  </div>

  <!-- Replace the personal introduction. -->
  <p style="margin: 28px 0 20px; line-height: 1.75;">Replace with a short personal introduction. Explain what you do, care about, or are currently building.</p>

  <div style="display: flex; flex-wrap: wrap; gap: 10px;">
    <!-- Replace the website label and href URL. -->
    <a href="https://example.com" style="padding: 9px 14px; border-radius: 999px; background: #ffffff; color: #9a3412; font-weight: 700; text-decoration: none;">Website</a>

    <!-- Replace the email label and mailto URL. -->
    <a href="mailto:you@example.com" style="padding: 9px 14px; border-radius: 999px; background: #ffffff; color: #9a3412; font-weight: 700; text-decoration: none;">Email</a>
  </div>
</section>`,
  },
];

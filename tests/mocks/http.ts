import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const handlers = [
  http.get('https://example.com/blog/skill-tutorial', () => {
    return HttpResponse.html(`
      <!DOCTYPE html>
      <html>
        <head><title>How to Build Skills</title></head>
        <body>
          <article>
            <h1>How to Build Skills</h1>
            <h2>Introduction</h2>
            <p>First, create a markdown file with your skill content.</p>
            <h2>Implementation</h2>
            <pre><code>
# My Skill

When working on tasks:
- Do this thing first
- Then do this other thing
            </code></pre>
            <p>Then install it to your agent using the install command.</p>
            <h2>Conclusion</h2>
            <p>Now you have a working skill!</p>
          </article>
        </body>
      </html>
    `);
  }),
  http.get('https://example.com/code-article', () => {
    return HttpResponse.html(`
      <!DOCTYPE html>
      <html>
        <head><title>Code Generation Tips</title></head>
        <body>
          <article>
            <h1>Code Generation Tips</h1>
            <p>Here are some tips for generating better code:</p>
            <pre><code>function example() {
  return "Hello world";
}</code></pre>
            <p>Always test your code!</p>
          </article>
        </body>
      </html>
    `);
  }),
  http.get('https://example.com/empty', () => {
    return HttpResponse.html('<html><body></body></html>');
  }),
  http.get('https://example.com/404', () => {
    return new HttpResponse(null, { status: 404, statusText: 'Not Found' });
  }),
  http.get('https://example.com/timeout', () => {
    return new Promise(() => {}); // Never resolves
  }),
];

export const server = setupServer(...handlers);

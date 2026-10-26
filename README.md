# Gank Carousel Grabber

Extract image URLs from a Gank service or post page. The web interface and JSON API run on the same server.

## Run

Requires Node.js 18 or newer.

```sh
npm start
```

The server listens on port `3006` by default. Set `PORT` to use another port.

## Server deployment

The production URL is `https://siggumaseven.men/image-grabber/`. Nginx redirects
`/image-grabber` to the trailing-slash URL and strips the prefix when forwarding
to port `3006`. Assets and API calls use relative URLs. `GET /health` returns
`{"ok":true}` without contacting Gank.

```sh
docker build -t gank-image-grabber .
docker run --rm -p 127.0.0.1:3006:3006 --read-only --cap-drop ALL \
  --security-opt no-new-privileges:true gank-image-grabber
```

The image runs tests during its build and contains only the web server and UI.
K3s manifests and the Nginx route template live in `otakuict/private-server-devops`
under `apps/gank-image-grabber` and `infrastructure/nginx`. See that repository's
`docs/image-grabber.md` for the initial server setup.

Before merging the deployment workflow, configure these GitHub Actions values:

| Type | Name | Value / scope |
| --- | --- | --- |
| Variable | `DOCKERHUB_USERNAME` | `otakuict` |
| Secret | `DOCKERHUB_TOKEN` | Push access to `otakuict/gank-image-grabber` |
| Secret | `GITOPS_DISPATCH_TOKEN` | DevOps repository Contents: Write |

Pull requests build and test only. On `main`, CI publishes a full commit-SHA
image tag and requests an image update PR in the DevOps repository. Merge the
DevOps onboarding PR before the first publish. New workloads initially have
zero replicas; enable one replica after the published image tag is configured.

The deployed API is `GET /image-grabber/api/extract?url=<encoded Gank URL>`.

## GET API

```http
GET /api/extract?url=<encoded Gank URL>
```

Pass a full `https://ganknow.com/services/...` or `https://ganknow.com/post/...` URL in the `url` query parameter. The API is accessible to other server applications and allows cross-origin browser requests.

```sh
curl --get "http://localhost:3006/api/extract" \
  --data-urlencode "url=https://ganknow.com/services/89471-yoichi69-260329-belle"
```

The JSON response has this shape:

```json
{
  "pageType": "service",
  "title": "Example service title",
  "sourceUrl": "https://ganknow.com/services/89471-yoichi69-260329-belle",
  "imageCount": 1,
  "images": [
    {
      "index": 1,
      "type": "image",
      "renderedUrl": "https://example.com/rendered-image",
      "originalUrl": "https://example.com/original-image",
      "thumbUrl": "https://example.com/thumbnail",
      "isPrimary": true,
      "description": ""
    }
  ]
}
```

`images` is ordered as on the source page. `originalUrl` is the URL intended for full-size images. Errors return JSON with an `error` message: `400` for a missing, invalid, or unsupported URL; `422` when no images are found; and `500` if extraction fails. The endpoint accepts `GET` and handles `OPTIONS` preflight requests.

Another service can call the endpoint like this:

```js
const endpoint = new URL("http://localhost:3006/api/extract");
endpoint.searchParams.set("url", "https://ganknow.com/post/6bca17eb-6b2e-494f-8d44-c3634d49c34d");

const response = await fetch(endpoint);
const result = await response.json();
if (!response.ok) throw new Error(result.error);
console.log(result.images.map((image) => image.originalUrl));
```

For a service on another machine, replace `localhost` with this server's reachable host or deployed URL.

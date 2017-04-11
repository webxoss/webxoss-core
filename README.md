# WEBXOSS

## Install

1. Clone this project

2. Init / Update submodule

  ```
  git submodule init
  git submodule update
  ```

3. Download copyrighted images

  ```
  cd webxoss-client
  curl http://webxoss.com/images.tar | tar xv
  ```

  Note:

  * The card images are copyrighted by Takara Tomy. *NO BUSINESS USE*.
  * If it's slow, you can replace `webxoss.com` with `cloudflare.webxoss.com`, `incapsula.webxoss.com` or `hongkong.webxoss.com:8080` to use proxy.
  * Card images are compressed. Use [webxoss-fetch](https://github.com/webxoss/wixoss-fetch) to get raw images.

4. Install dependencies

  ```
  npm install
  ```

## Run

WEBXOSS can be runned in 2 modes: node or browser.

### Node mode

Use nodejs to create a WEBXOSS server over network.

```
# listen to 127.0.0.1:80
node test.js

# or specify a port
node test.js port=8080
```

Then open `localhost`. That's it.

### Browser mode

WEBXOSS server can be runned in a browser tab, typically for easier debugging.

In this case, nodejs isn't needed. Just serve this project using `nginx`, `apache` or anything else.

Then, open `127.0.0.1` (map to `webxoss-core` folder). The browser tab you just opened is a real WEBXOSS server. You can open console to see what's inside it. 

Note: 

* The "server" and "client" tabs use `postMessage` to simulate network communications. So you can only play with yourself in a browser.
* See this [test guide](https://github.com/webxoss/webxoss-core/wiki/howToTest) for more test tricks.

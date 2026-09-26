# Comments

Comments is a plugin for [Kite](https://github.com/kite-plus/kite) that puts
a comment thread under every post, with one of three services:

- [Giscus](https://giscus.app), which keeps comments in the Discussions of a
  GitHub repository
- [Waline](https://waline.js.org), on a server of your own
- [Twikoo](https://twikoo.js.org), on a server of your own or on Tencent
  CloudBase

The thread follows the page into dark mode and back, whether the theme
follows the system or has a switch of its own.

## Using it

Drop the zip of a release on the upload tile under **Plugins** in Kite's
studio, or add it from the command line inside a site:

```sh
kite plugin add comments-0.1.0.zip
kite plugin enable comments
```

Then choose the service under **Plugins → Comments → Settings**:

- **Giscus**: pick the repository and the discussion category on
  [giscus.app](https://giscus.app), and copy the repository, its ID, the
  category and its ID into the settings. A post is matched to its discussion
  by its id by default, which stays the same when the post's address
  changes.
- **Waline**: the address of your Waline server.
- **Twikoo**: the address of your Twikoo server, or the environment ID on
  Tencent CloudBase.

Waline and Twikoo load their scripts from jsDelivr, unpkg or npmmirror, as
the settings say; npmmirror is the quicker one from mainland China.

The plugin asks for Kite 1.0 or later.

## Where the thread goes

At the end of the page's `<main>`, after the post and whatever follows it
there. A theme that wants it elsewhere marks the spot:

```html
<div data-kite-comments></div>
```

A post leaves the thread out with `comments: false` in its front matter, and
pages get one too when **Under pages too** is on.

## Releasing

`make zip` packs `dist/comments-<version>.zip`, which the studio installs as
it is. Check it with `kite plugin verify .`, then tag the release and attach
the zip.

## License

[Apache License 2.0](LICENSE).

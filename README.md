Cakepan
=======

Frontend developer toolkit to integrate your HTML/JS/CSS. Designed to work expressly with Symfony2, Silex and Wordpress project.

Provides a way to quickly design the front-end of a new responsive website.
Can be easily plugged to Symfony2, Silex or Wordpress.

Using best in class tools:

* [nodejs](http://nodejs.org/)
* [{less}](http://lesscss.org)
* [gulpjs](http://gulpjs.com)
* [HTML5 boilerplate](http://html5boilerplate.com)
* [BrowserSync](http://www.browsersync.io)
* [Bootstrap](http://getbootstrap.com/)
* [Font Awesome](http://fortawesome.github.io/Font-Awesome)
* [twig](http://twig.sensiolabs.org/) and [twig.js](https://github.com/justjohn/twig.js)

Getting Started
---------------

Install dependencies:

    npm install -g bower browser-sync gulp
    npm install

Build website and start dev webserver:

    npm start

More about building
-------------------

If you want to build the source:

    gulp


If you want to build the source for the production, simply run:

    gulp --prod

> take car it will erase every templates and every assets.

If you want to start dev webserver:

    gulp start

If you want to start dev webserver without relaunching a browser window:

    gulp start --no

Proxy mode allows to serve pages from another webserver (like PHP) while continuing to edit JS and CCS into Cakepan source dir.
If you want to enable proxy mode, set proxy.url proxy.watch_dir and proxy.watch_files in your app.config.json and run:

    gulp --proxy

If you want to clean build directory:

    gulp clean

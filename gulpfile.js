var gulp = require('gulp')
    path = require('path'),
    less = require('gulp-less'),
    jshint = require('gulp-jshint'),
    uglify = require('gulp-uglify'),
    concat = require('gulp-concat'),
    del = require('del'),
    minifyCSS = require('gulp-minify-css'),
    plumber = require('gulp-plumber'),
    gulpif = require('gulp-if'),
    argv = require('minimist')(process.argv.slice(2)),
    browserSync = require('browser-sync'),
    notify = require('gulp-notify')
    twigger = require('gulp-twigger'),
    rename = require('gulp-rename'),
    merge = require('merge-stream'),
    sourcemaps = require('gulp-sourcemaps')
    deepmerge = require('deepmerge'),
    wiredep = require('wiredep')
;

var defaults = {
  //destination directory (dev only)
  build_dir: 'build/',

  //destination sub-directory (into build_dir) for assets (js, css, fonts, etc...)
  app_dir: '/app',

  //if you want to use plain html files instead of twig, set html_dir to a directory path and set twig_dir to null
  // html_dir: 'src/',
  // twig_dir: null,

  html_dir: null,
  twig_dir: 'src/twig',

  //less config, `null` to ignore it
  less: {
    //where to look for included files
    includes_dir:  ['bower_components'],

    //main files to build
    files: 'main.less',

    //where to look for source files (relative to root)
    source_dir : 'src/less/',

    //destination subdirectory for built files (into buil_dir/app_dir)
    dest_dir: 'css/',

    //where to put maps files (prod only)
    maps_dir: '../maps/'
  },

  //files to dump (key is a glob, and value the destination sub-directory in app_dir)
  dump_files: {},

  //js config, `null` to ignore it
  js: {
    //js to concat into destination
    requires: [],

    //where to look for source files (relative to root)
    source_dir: 'src/js/',

    //main file to build
    files: 'main.js',

    //destination subdirectory for built files (into buil_dir/app_dir)
    dest_dir: 'js/',

    // main concatened filename
    dest_main_filename: 'main.js',

    // vendor concatened filename
    dest_vendor_filename: 'vendor.js',

    //js files to dump into dest_dir (after uglification for prod)
    dump: [],

    // js vendors to exclude from wiredep
    exclude_vendors: [],

    //where to put maps files (prod only)
    maps_dir: '../maps/'
  },

  // default config related to browserSync
  browserSync: {
    // open new tab in browser
    open: ((argv['no'] == undefined)?true:false),

    // assumes you're online
    online: false,

    // config for built-in static server
    server : {
      directory: true
    }
  }
}

// Add config for browserSync server baseDir
defaults.browserSync.server.baseDir = defaults.build_dir;

var config = deepmerge(defaults, require('./app.config.json'));

if (argv['mode']) {
  config = deepmerge(config, require('./' + argv['mode'] + '.config.json'));
}

//uncomment this line and comment the line before if you want to build the sdk
// var config = deepmerge(defaults, require('./sdk.config.json'));

gulp.task('clean', function () {
  del.sync(path.join(config.build_dir, config.app_dir), {force: true});
});

gulp.task('less', function () {

  if (config.less == null) {
    return null;
  }

  return gulp.src(path.join(config.less.source_dir, config.less.files))
    .pipe(plumber({errorHandler: notify.onError("<%= error.name %>: <%= error.message %>")}))
    .pipe(sourcemaps.init())
    .pipe(less({
      paths: config.less.includes_dir
    }))
    .pipe(gulpif(argv.prod !== undefined, minifyCSS()))
    .pipe(plumber.stop())
    .pipe(gulp.dest(path.join(config.build_dir, config.app_dir, config.less.dest_dir)))
    .pipe(browserSync.reload({stream:true}))
    .pipe(sourcemaps.write(config.less.maps_dir));
});

gulp.task('html', function () {

  if (config.html_dir == null) {
    return null;
  }

  return gulp.src(path.join(config.html_dir, '**/*.html'))
      .pipe(gulp.dest(config.build_dir))
      .pipe(browserSync.reload({stream:true}));
});

gulp.task('twig', function () {

  if (config.twig_dir == null) {
    return null;
  }

  return gulp.src(path.join(config.twig_dir, '**/[^_]*.twig'))
      .pipe(plumber({errorHandler: notify.onError("<%= error.name %>: <%= error.message %>")}))
      .pipe(twigger({base: config.twig_dir}))
      .pipe(rename(function (path) {
        path.extname = ''; // strip the .twig extension
      }))
      .pipe(gulp.dest(config.build_dir))
      .pipe(plumber.stop())
      .pipe(browserSync.reload({stream:true}));
});

gulp.task('dump', function() {

  if (config.dump_files == null) {
    return null;
  }

  var stream = null;
  Object.keys(config.dump_files).forEach(function(glob, index) {

    var dest = this[glob];
    var newStream = gulp.src(glob)
      .pipe(rename(function(filepath) {
        filepath.dirname = path.join(dest, filepath.dirname);
      }))
      .pipe(gulp.dest(path.join(config.build_dir, config.app_dir)))
      .pipe(browserSync.reload({stream:true}));

    if (stream == null) {
      stream = newStream;
    } else {
      stream = merge(stream, newStream);
    }
  }, config.dump_files);
});

//copy html5shiv as it
gulp.task('dumpjs', function() {
  var stream = gulp.src(config.js.dump);

  if (argv.prod != undefined) {
    // .pipe(sourcemaps.init({loadMaps: true}))
    stream = stream.pipe(uglify())
    // .pipe(sourcemaps.write(config.js.maps_dir))
  }

  return stream.pipe(gulp.dest(path.join(config.build_dir, config.app_dir, config.js.dest_dir)))
});

gulp.task('lint', function() {
  return gulp.src(path.join(config.js.source_dir, config.js.files))
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
  ;
});

gulp.task('vendor-js', function() {
  return gulp.src(wiredep({ exclude: config.js.exclude_vendors.concat(config.js.dump) }).js)
    .pipe(concat(config.js.dest_vendor_filename))
    .pipe(gulpif(argv.prod !== undefined, uglify()))
    .pipe(gulp.dest(path.join(config.build_dir, config.app_dir, config.js.dest_dir)))
  ;
});

gulp.task('js', ['lint'], function() {

  if (config.js == null) {
    return null;
  }

  return gulp.src(path.join(config.js.source_dir, config.js.files))
    .pipe(plumber({errorHandler: notify.onError("<%= error.name %>: <%= error.message %>")}))
    .pipe(sourcemaps.init())
    .pipe(concat(config.js.dest_main_filename))
    .pipe(gulpif(argv.prod !== undefined, uglify()))
    .pipe(plumber.stop())
    .pipe(gulp.dest(path.join(config.build_dir, config.app_dir, config.js.dest_dir)))
    .pipe(browserSync.reload({stream:true}))
    .pipe(sourcemaps.write(config.js.maps_dir));
});

gulp.task('browser-sync', function() {
  browserSync.init(
    [path.join(config.build_dir, config.app_dir, '**/**.*')],
    config.browserSync
  );
});

gulp.task('browser-sync-refresh', function() {
  browserSync.reload();
});

gulp.task('start', ['default', 'browser-sync'], function() {
  if (config.html_dir != null) {
    gulp.watch(path.join(config.html_dir, '**/*.html'), ['html']);
  }

  if (config.twig_dir != null) {
    gulp.watch(path.join(config.twig_dir, '**/*.{twig,json}'), ['twig']);
  }

  if (argv['mode'] === 'proxy') {
    gulp.watch(path.join(config.proxy.watch_dir, config.proxy.watch_files), ['browser-sync-refresh']);
  }

  gulp.watch(path.join(config.js.source_dir, '**/*.js'), ['js']);
  gulp.watch(path.join(config.less.source_dir, '**/*.less'), ['less']);
  gulp.watch(['bower_components/', 'bower.json'], ['vendor-js']);
  gulp.watch(Object.keys(config.dump_files), ['dump']);
  // gulp.watch('gulpfile.js', ['default']);
});

gulp.task('default', ['clean', 'less', 'html', 'twig', 'dump', 'dumpjs', 'vendor-js', 'js']);
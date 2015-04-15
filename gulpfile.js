var gulp = require('gulp')
    path = require('path'),
    less = require('gulp-less'),
    sass = require('gulp-ruby-sass'),
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
    twig = require('gulp-twig'),
    rename = require('gulp-rename'),
    merge = require('merge-stream'),
    sourcemaps = require('gulp-sourcemaps')
    deepmerge = require('deepmerge'),
    wiredep = require('wiredep'),
    replace = require('gulp-replace-task'),
    data = require('gulp-data')
;

var booleanOptions = ['compile'];

var defaults = {

  // version added only with prod option, can be set to null
  version: null,

  //destination directory (dev only)
  build_dir: 'build/',

  //destination sub-directory (into build_dir) for assets (js, css, fonts, etc...)
  app_dir: '/app',

  //if you want to use plain html files instead of twig, set html_dir to a directory path and set twig_dir to null
  // html_dir: 'src/',
  // twig_dir: null,

  html_dir: null,
  twig_dir: 'src/twig',

  // if you want to minified source pass it to true
  compile: false,

  //less config, `null` to ignore it in app.config.json
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

  // sass config, `null` to ignore it in app.config.json
  sass: {
    // path source files
    source_dir : 'src/sass/',

    // main file dest dir
    dest_dir: 'css/',

    // map dir relative to dest_dir
    maps_dir : '../maps/',

    // main file to load
    files : 'main.scss',

    // css files to transform in scss
    requires : [],

    // lib to includes
    includes : [
      'src/sass/',
      'bower_components/bootstrap-sass/assets/stylesheets',
      'bower_components/fontawesome/scss'
    ]
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
  },

  // Defaul proxy configuration
  proxy: {
    url: false,
    watch_files: null
  }
}

// Add config for browserSync server baseDir
defaults.browserSync.server.baseDir = defaults.build_dir;

var config = deepmerge(defaults, require('./app.config.json'));

try {
  if (argv['mode'] ) {
    config = deepmerge(config, require('./' + argv['mode'] + '.config.json'));
  }
} catch(e) {
  gulp
    .src('')
    .pipe(notify(e.message))
  ;
}

// Overide config with option
Object.keys(argv).forEach(function(item) {
  if (item !== '_' && item !== 'mode') {
    var obj = {};
    obj[item] = (booleanOptions.indexOf(item) !== -1) ? (this[item] === 'true') : this[item];
    config = deepmerge(config, obj);
  }
}, argv);

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
      .pipe(gulpif(config.compile, minifyCSS()))
      .pipe(gulpif(config.version !== null, rename({
        suffix: '-' + config.version
      })))
    .pipe(gulpif(config.compile, sourcemaps.write(config.less.maps_dir)))
    .pipe(gulp.dest(path.join(config.build_dir, config.app_dir, config.less.dest_dir)))
    .pipe(plumber.stop())
    .pipe(browserSync.reload({stream:true}))
  ;
});

gulp.task('cssToScss', function() {

  if (config.sass == null) {
    return null;
  }

  var stream = null;

  config.sass.requires.forEach(function(filepath) {
    var newStream = gulp.src(path.join(filepath, '*.css'))
      .pipe(rename({
        extname: '.scss'
      }))
      .pipe(gulp.dest(filepath))
    ;

    stream = (stream !== null) ? mergestream(stream, newStream) : newStream;
  });

  return stream;
});

gulp.task('sass', ['cssToScss'], function() {

  if (config.sass == null) {
    return null;
  }

  return sass(path.join(config.sass.source_dir, config.sass.files), {
      sourcemap: true,
      loadPath: config.sass.includes.concat(config.sass.requires)
    })
    .pipe(plumber())
    // .pipe(sourcemaps.write(config.sass.maps_dir))
    .pipe(gulpif(config.compile, minifyCSS()))
    .pipe(gulpif(config.version !== null, rename({
      suffix: '-' + config.version
    })))
    .pipe(plumber.stop())
    .pipe(gulp.dest(path.join(config.build_dir, config.app_dir, config.sass.dest_dir)))
    .pipe(browserSync.reload({stream:true}))
  ;
});

gulp.task('html', function () {

  if (config.html_dir == null) {
    return null;
  }

  return gulp.src(path.join(config.html_dir, '**/*.html'))
    .pipe(replace({
      patterns: [
        {
          match: 'version',
          replacement: (config.version !== null) ? '-' + config.version : ''
        }
      ]
    }))
    .pipe(gulp.dest(config.build_dir))
    .pipe(browserSync.reload({stream:true}))
  ;
});

gulp.task('twig', function () {

  if (config.twig_dir == null) {
    return null;
  }

  return gulp.src(path.join(config.twig_dir, '**/[^_]*.twig'))
      .pipe(plumber({errorHandler: notify.onError("<%= error.name %>: <%= error.message %>")}))
      .pipe(data(function(file) {
        var data;

        try {
          data = require(path.dirname(file.path) + '/' + path.basename(file.path, '.html.twig') + '.vars.json');
        } catch(e) {
          data = {};
        }

        return deepmerge(
          data,
          { version : (argv['prod'] && config.version !== null) ? '-' + config.version : '' }
        );
      }))
      .pipe(twig({
        base: config.twig_dir
      }))
      .pipe(rename({
        extname: ''
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
    ;

    if (stream == null) {
      stream = newStream;
    } else {
      stream = merge(stream, newStream);
    }

  }, config.dump_files);

  return stream
    .pipe(browserSync.reload({stream:true}))
    .pipe(gulp.dest(path.join(config.build_dir, config.app_dir)))
  ;
});

//copy html5shiv as it
gulp.task('dumpjs', function() {
  return gulp.src(config.js.dump)
    .pipe(gulpif(config.compile, uglify()))
    .pipe(gulp.dest(path.join(config.build_dir, config.app_dir, config.js.dest_dir)))
  ;
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
    .pipe(gulpif(config.compile, uglify()))
    .pipe(gulpif(config.version !== null, rename({
      suffix: '-' + config.version
    })))
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
      .pipe(gulpif(config.compile, uglify()))
      .pipe(plumber.stop())
      .pipe(gulpif(config.version !== null, rename({
        suffix: '-' + config.version
      })))
    .pipe(gulpif(config.compile, sourcemaps.write(config.js.maps_dir)))
    .pipe(gulp.dest(path.join(config.build_dir, config.app_dir, config.js.dest_dir)))
    .pipe(browserSync.reload({stream:true}))
    .pipe(plumber.stop())
});

gulp.task('browser-sync', function() {
  browserSync.init(
    [path.join(config.build_dir, config.app_dir, '**/**.*')],
    deepmerge(config.browserSync, { proxy: config.proxy.url })
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

  if (config.twig_dir === null && config.html_dir === null) {
    gulp.watch(config.proxy.watch_files, ['browser-sync-refresh']);
  }

  if (config.less != null) {
    gulp.watch(path.join(config.less.source_dir, '**/*.less'), ['less']);
  }

  if (config.sass != null) {
    gulp.watch(path.join(config.sass.source_dir, '**/*.scss'), ['sass']);
  }

  gulp.watch(path.join(config.js.source_dir, '**/*.js'), ['js']);
  gulp.watch(['bower_components/', 'bower.json'], ['vendor-js']);
  gulp.watch(Object.keys(config.dump_files), ['dump']);
});

gulp.task('default', ['clean', 'less', 'sass', 'html', 'twig', 'dump', 'dumpjs', 'vendor-js', 'js']);

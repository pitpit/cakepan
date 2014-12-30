var gulp = require('gulp')
    path = require('path'),
    less = require('gulp-less'),
    jshint = require('gulp-jshint'),
    uglify = require('gulp-uglify'),
    concat = require('gulp-concat'),
    rimraf = require('rimraf'),
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
    deepmerge = require('deepmerge');

var defaults = {
  //destination directory (dev only)
  build_dir: 'build/',

  //destination sub-directory (into build_dir) for assets (js, css, fonts, etc...)
  app_dir: '/app',

  twig_dir: 'src/views/',

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

    //concatened filename
    dest_filename: 'main.js',

    //js files to dump into dest_dir (after uglification for prod)
    dump: [],

    //where to put maps files (prod only)
    maps_dir: '../maps/'
  }
}

var config = deepmerge(defaults, require('./app.config.json'));

//uncomment this line and comment the line before if you want to build the sdk
// var config = deepmerge(defaults, require('./sdk.config.json'));

gulp.task('clean', function (cb) {
    rimraf.sync(config.build_dir, cb);
});

gulp.task('less', function () {

  if (config.less == null) {
    return null;
  }

  var stream =  gulp.src(path.join(config.less.source_dir, config.less.files))
    .pipe(plumber({errorHandler: notify.onError("<%= error.name %>: <%= error.message %>")}));

    if (argv.prod != undefined) {
      stream = stream
        .pipe(sourcemaps.init())
          .pipe(less({
            paths: config.less.includes_dir
          }))
          .pipe(minifyCSS({keepSpecialComments: 0}))
        .pipe(sourcemaps.write(config.less.maps_dir))
    } else {
      stream = stream.pipe(less({
        paths: config.less.includes_dir
      }))
    }

  return stream
    .pipe(plumber.stop())
    .pipe(gulp.dest(path.join(config.build_dir, config.app_dir, config.less.dest_dir)));
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
});

gulp.task('js', ['lint'], function() {

  if (config.js == null) {
    return null;
  }

  var files = config.js.requires;
  files.push(path.join(config.js.source_dir, config.js.files));

  var stream = gulp.src(files);

  if (argv.prod != undefined) {
    stream = stream
      .pipe(sourcemaps.init())
        .pipe(concat(config.js.dest_filename))
        .pipe(uglify())
      .pipe(sourcemaps.write(config.js.maps_dir))
  } else {
    stream = stream.pipe(concat(config.js.dest_filename))
  }

  return stream
      .pipe(gulp.dest(path.join(config.build_dir, config.app_dir, config.js.dest_dir)))
      .pipe(browserSync.reload({stream:true}));
});

gulp.task('browser-sync', function() {
  browserSync.init([path.join(config.build_dir, config.app_dir, '**/**.*')], {
    open: ((argv['no'] == undefined)?true:false),
    server: {
      directory: true,
      baseDir: config.build_dir
    }
  });
});

gulp.task('default', ['clean', 'less', 'twig', 'dump', 'dumpjs', 'js']);

gulp.task('start', ['browser-sync'], function() {
  gulp.watch(path.join(config.twig_dir, '**/*.{twig,json}'), ['twig']);
  gulp.watch(path.join(config.js.source_dir, '**/*.js'), ['js']);
  gulp.watch(path.join(config.less.source_dir, '**/*.less'), ['less']);
  gulp.watch('gulpfile.js', ['default']);
});
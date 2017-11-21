# Monorepo

* Datapull is organized as a monorepo. 
* Source code is in packages/@datapull folder
* `node_modules/` in the root folder is the symlink that allows to run exploratory tests right in this repo
* `packages/datapull` is a symlink to a CLI executable that is used to run exploratory tests

# Get started
1. Install lerna globally:
```
$ npm install -g lerna
```

2. Install dependencies for all modules:
```
$ lerna bootstrap
```

# How to add a dependency to a module
This has to be done by manually navigating to that module's folder. Example: 
```
$ cd node_modules/@datapull/cli
$ npm install commander --save
```

# How to run an exploratory test:
Pick one of the example files and run a preview of that pipeline (preview allows you to fetch data from an origin without pulling it to a destination)
```
$ ./packages/datapull preview examples/http-test.yml
```

# How to publish new version of all updated modules:
```
$ lerna publish
```

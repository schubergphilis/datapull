# Monorepo

Datapull is organized as a monorepo. 
Source code is in node_modules/@datapull folder

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
Example: 
```
$ cd node_modules/@datapull/cli
$ npm install commander --save
```

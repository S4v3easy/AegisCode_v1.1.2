aegiscode
=================

AI Code Governance & Architecture Guardrails


[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/aegiscode.svg)](https://npmjs.org/package/aegiscode)
[![Downloads/week](https://img.shields.io/npm/dw/aegiscode.svg)](https://npmjs.org/package/aegiscode)


<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g aegiscode
$ aegis COMMAND
running command...
$ aegis (--version)
aegiscode/0.0.0 linux-x64 node-v24.13.0
$ aegis --help [COMMAND]
USAGE
  $ aegis COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`aegis hello PERSON`](#aegis-hello-person)
* [`aegis hello world`](#aegis-hello-world)
* [`aegis help [COMMAND]`](#aegis-help-command)
* [`aegis plugins`](#aegis-plugins)
* [`aegis plugins add PLUGIN`](#aegis-plugins-add-plugin)
* [`aegis plugins:inspect PLUGIN...`](#aegis-pluginsinspect-plugin)
* [`aegis plugins install PLUGIN`](#aegis-plugins-install-plugin)
* [`aegis plugins link PATH`](#aegis-plugins-link-path)
* [`aegis plugins remove [PLUGIN]`](#aegis-plugins-remove-plugin)
* [`aegis plugins reset`](#aegis-plugins-reset)
* [`aegis plugins uninstall [PLUGIN]`](#aegis-plugins-uninstall-plugin)
* [`aegis plugins unlink [PLUGIN]`](#aegis-plugins-unlink-plugin)
* [`aegis plugins update`](#aegis-plugins-update)

## `aegis hello PERSON`

Say hello

```
USAGE
  $ aegis hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ aegis hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/S4V3easy/aegiscode/blob/v0.0.0/src/commands/hello/index.ts)_

## `aegis hello world`

Say hello world

```
USAGE
  $ aegis hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ aegis hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/S4V3easy/aegiscode/blob/v0.0.0/src/commands/hello/world.ts)_

## `aegis help [COMMAND]`

Display help for aegis.

```
USAGE
  $ aegis help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for aegis.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/6.2.58/src/commands/help.ts)_

## `aegis plugins`

List installed plugins.

```
USAGE
  $ aegis plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ aegis plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.4.87/src/commands/plugins/index.ts)_

## `aegis plugins add PLUGIN`

Installs a plugin into aegis.

```
USAGE
  $ aegis plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into aegis.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the AEGIS_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the AEGIS_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ aegis plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ aegis plugins add myplugin

  Install a plugin from a github url.

    $ aegis plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ aegis plugins add someuser/someplugin
```

## `aegis plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ aegis plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ aegis plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.4.87/src/commands/plugins/inspect.ts)_

## `aegis plugins install PLUGIN`

Installs a plugin into aegis.

```
USAGE
  $ aegis plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into aegis.

  Uses npm to install plugins.

  Installation of a user-installed plugin will override a core plugin.

  Use the AEGIS_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the AEGIS_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ aegis plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ aegis plugins install myplugin

  Install a plugin from a github url.

    $ aegis plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ aegis plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.4.87/src/commands/plugins/install.ts)_

## `aegis plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ aegis plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.

  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ aegis plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.4.87/src/commands/plugins/link.ts)_

## `aegis plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ aegis plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ aegis plugins unlink
  $ aegis plugins remove

EXAMPLES
  $ aegis plugins remove myplugin
```

## `aegis plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ aegis plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.4.87/src/commands/plugins/reset.ts)_

## `aegis plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ aegis plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ aegis plugins unlink
  $ aegis plugins remove

EXAMPLES
  $ aegis plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.4.87/src/commands/plugins/uninstall.ts)_

## `aegis plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ aegis plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  [PLUGIN...]  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ aegis plugins unlink
  $ aegis plugins remove

EXAMPLES
  $ aegis plugins unlink myplugin
```

## `aegis plugins update`

Update installed plugins.

```
USAGE
  $ aegis plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/5.4.87/src/commands/plugins/update.ts)_
<!-- commandsstop -->

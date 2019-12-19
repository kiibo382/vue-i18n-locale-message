import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import { Arguments, Argv } from 'yargs'

import { debug as Debug } from 'debug'
const debug = Debug('vue-i18n-locale-message:commands:pull')

const mkdirPromisify = promisify(fs.mkdir)
const writeFilePromisify = promisify(fs.writeFile)

import { resolve, loadProvider, loadProviderConf, DEFUALT_CONF } from '../utils'
import { ProviderPullResource, Locale, LocaleMessage } from '../../types'

type PullOptions = {
  provider: string
  conf?: string
  output: string
  locales?: string
  dryRun?: boolean
}

export const command = 'pull'
export const aliases = 'pl'
export const describe = 'pull locale messages from localization service'

export const builder = (args: Argv): Argv<PullOptions> => {
  return args
    .option('provider', {
      type: 'string',
      alias: 'p',
      describe: 'the target localization service provider',
      demandOption: true
    })
    .option('conf', {
      type: 'string',
      alias: 'c',
      describe: 'the json file configration of localization service provider'
    })
    .option('output', {
      type: 'string',
      alias: 'o',
      describe: 'the path to output that pulled locale messages',
      demandOption: true
    })
    .option('locales', {
      type: 'string',
      alias: 'l',
      default: '',
      describe: `option for some locales of locale messages, you can also be specified multi locale with comma delimiter. if it's not specified pull all locale messages`
    })
    .option('dryRun', {
      type: 'boolean',
      alias: 'd',
      default: false,
      describe: 'run the pull command, but do not pull to locale messages of localization service'
    })
}

export const handler = async (args: Arguments<PullOptions>): Promise<unknown> => {
  const ProviderFactory = loadProvider(args.provider)

  if (ProviderFactory === null) {
    // TODO: should refactor console message
    console.log(`Not found ${args.provider} provider`)
    return
  }

  if (!args.output) {
    // TODO: should refactor console message
    console.log('You need to specify --output')
    return
  }

  let conf = DEFUALT_CONF
  if (args.conf) {
    conf = loadProviderConf(resolve(args.conf))
  }

  try {
    const locales = args.locales?.split(',').filter(p => p) as Locale[] || []
    const provider = ProviderFactory(conf)
    const resource = await provider.pull(locales, args.dryRun)
    await applyPullResource(args.output, resource, args.dryRun)
    // TODO: should refactor console message
    console.log('pull success')
  } catch (e) {
    console.error('pull fail', e)
    return
  }
}

async function applyPullResource (output: string, resource: ProviderPullResource, dryRun: boolean) {
  const locales = Object.keys(resource) as Locale[]
  debug('applyPullResource', resource, locales, dryRun)
  // wrap mkdir with dryRun
  const mkdir = async (output: string) => {
    return !dryRun
      ? mkdirPromisify(path.resolve(output), { recursive: true })
      : Promise.resolve()
  }

  // wrap writeFile with dryRun
  const writeFile = async (output: string, locale: Locale, message: LocaleMessage) => {
    const localePath = path.resolve(output, `${locale}.json`)
    console.log(`write '${locale}' messages to ${localePath}`)
    return !dryRun
      ? writeFilePromisify(localePath, JSON.stringify(message, null, 2))
      : Promise.resolve()
  }

  // run!
  await mkdir(output)
  for (const locale of locales) {
    await writeFile(output, locale, resource[locale])
  }
}

export default {
  command,
  aliases,
  describe,
  builder,
  handler
}
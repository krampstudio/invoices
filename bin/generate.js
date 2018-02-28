#! /usr/bin/env node

const pkg        = require('../package.json');
const program    = require('commander');
const path       = require('path');
const fs         = require('fs-extra');
const Handlebars = require('handlebars');
const accounting = require('accounting');

const types = ['invoice', 'creditnote'];

const projectRoot = path.resolve(__dirname, '..');

const processData = data => {
    if(data.items){
        let total = 0;
        data.items.forEach( item => {
            item.rowPrice = item.price * item.count;
            total += item.rowPrice;
        });
        if(typeof data.vat === 'number' && data.vat > 0){
            data.totalExcludingTaxes = total;
            data.totalTaxes = (total * data.vat) / 100;
            data.total = total + data.totalIncludingTaxes;
        } else {
            data.total = total;
        }
    }
    return data;
};

const generateTemplate = async (tplFile, outputFile, context) => {
    const tplContent = await fs.readFile(tplFile, 'utf-8');
    const template = Handlebars.compile(tplContent);
    return await fs.writeFile(outputFile, template(context));
};

const getPreviousDocs = async (outputDir) => {
    const docs  = {};
    const files = await fs.readdir(outputDir);
    return files
        .map( f => path.basename(f))
        .filter( name => /\.html$/.test(name))
        .reduce( (acc, name) => {
            types.forEach( type => {
                if(new RegExp('^' + type).test(name)){
                    acc[type] = acc[type] || [];
                    acc[type].push(name);
                }
            });
            return acc;
        }, docs);
};

Handlebars.registerHelper('eur', value => accounting.formatMoney(value, '€', 2, ' ', ',', '%v %s'));


program
    .version(pkg.version)
    .usage('[options]')
    .option('-t, --type <type>', 'Document type',  new RegExp(`^(${types.join('|')})$`), 'invoice')
    .option('-d, --data [data]', 'Data file')
    .option('-o, --output [value]', 'Output directory', path.join(projectRoot, 'dist'))
    .option('-p, --print', 'Print file')
    .parse(process.argv);

( async () => {
    try {
        const indexTemplate = path.join(projectRoot, 'src/tpl/index.hbs');
        const indexOutput   = path.join(program.output, 'index.html');

        const templateFile = path.join(projectRoot, 'src/tpl', `${program.type}.hbs`);
        const dataFile = path.join(projectRoot, 'data', `${program.data}.json`);
        const outputFile = path.join(program.output, `${program.data}.html`);
        const data  = await fs.readJson(dataFile);
        await generateTemplate(templateFile, outputFile, processData(data));

        const docData = await getPreviousDocs(program.output);
        await generateTemplate(indexTemplate, indexOutput, docData);

        if( program.print ) {
            //TODO with pupetter
        } else {
            console.log(`File ${outputFile} generated`);
        }
    } catch(err) {
        console.error(err);
    }
})();

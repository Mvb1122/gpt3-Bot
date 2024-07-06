/* Command loading order:
1. Require the basic module.
2. Run OnConfigureSecurity (Should change module.exports.data) here.
3. Command activated. (execute and OnMessageRecieved work now.) 
*/

/**
 * @type {[{
        name: string,
        value: string
    }]}
 */
let languageData = `
Automatic	auto
Acehnese (Arabic script)	ace_Arab
Acehnese (Latin script)	ace_Latn
Mesopotamian Arabic	acm_Arab
Ta’izzi-Adeni Arabic	acq_Arab
Tunisian Arabic	aeb_Arab
Afrikaans	afr_Latn
South Levantine Arabic	ajp_Arab
Akan	aka_Latn
Amharic	amh_Ethi
North Levantine Arabic	apc_Arab
Modern Standard Arabic	arb_Arab
Modern Standard Arabic (Romanized)	arb_Latn
Najdi Arabic	ars_Arab
Moroccan Arabic	ary_Arab
Egyptian Arabic	arz_Arab
Assamese	asm_Beng
Asturian	ast_Latn
Awadhi	awa_Deva
Central Aymara	ayr_Latn
South Azerbaijani	azb_Arab
North Azerbaijani	azj_Latn
Bashkir	bak_Cyrl
Bambara	bam_Latn
Balinese	ban_Latn
Belarusian	bel_Cyrl
Bemba	bem_Latn
Bengali	ben_Beng
Bhojpuri	bho_Deva
Banjar (Arabic script)	bjn_Arab
Banjar (Latin script)	bjn_Latn
Standard Tibetan	bod_Tibt
Bosnian	bos_Latn
Buginese	bug_Latn
Bulgarian	bul_Cyrl
Catalan	cat_Latn
Cebuano	ceb_Latn
Czech	ces_Latn
Chokwe	cjk_Latn
Central Kurdish	ckb_Arab
Crimean Tatar	crh_Latn
Welsh	cym_Latn
Danish	dan_Latn
German	deu_Latn
Southwestern Dinka	dik_Latn
Dyula	dyu_Latn
Dzongkha	dzo_Tibt
Greek	ell_Grek
English	eng_Latn
Esperanto	epo_Latn
Estonian	est_Latn
Basque	eus_Latn
Ewe	ewe_Latn
Faroese	fao_Latn
Fijian	fij_Latn
Finnish	fin_Latn
Fon	fon_Latn
French	fra_Latn
Friulian	fur_Latn
Nigerian Fulfulde	fuv_Latn
Scottish Gaelic	gla_Latn
Irish	gle_Latn
Galician	glg_Latn
Guarani	grn_Latn
Gujarati	guj_Gujr
Haitian Creole	hat_Latn
Hausa	hau_Latn
Hebrew	heb_Hebr
Hindi	hin_Deva
Chhattisgarhi	hne_Deva
Croatian	hrv_Latn
Hungarian	hun_Latn
Armenian	hye_Armn
Igbo	ibo_Latn
Ilocano	ilo_Latn
Indonesian	ind_Latn
Icelandic	isl_Latn
Italian	ita_Latn
Javanese	jav_Latn
Japanese	jpn_Jpan
Kabyle	kab_Latn
Jingpho	kac_Latn
Kamba	kam_Latn
Kannada	kan_Knda
Kashmiri (Arabic script)	kas_Arab
Kashmiri (Devanagari script)	kas_Deva
Georgian	kat_Geor
Central Kanuri (Arabic script)	knc_Arab
Central Kanuri (Latin script)	knc_Latn
Kazakh	kaz_Cyrl
Kabiyè	kbp_Latn
Kabuverdianu	kea_Latn
Khmer	khm_Khmr
Kikuyu	kik_Latn
Kinyarwanda	kin_Latn
Kyrgyz	kir_Cyrl
Kimbundu	kmb_Latn
Northern Kurdish	kmr_Latn
Kikongo	kon_Latn
Korean	kor_Hang
Lao	lao_Laoo
Ligurian	lij_Latn
Limburgish	lim_Latn
Lingala	lin_Latn
Lithuanian	lit_Latn
Lombard	lmo_Latn
Latgalian	ltg_Latn
Luxembourgish	ltz_Latn
Luba-Kasai	lua_Latn
Ganda	lug_Latn
Luo	luo_Latn
Mizo	lus_Latn
Standard Latvian	lvs_Latn
Magahi	mag_Deva
Maithili	mai_Deva
Malayalam	mal_Mlym
Marathi	mar_Deva
Minangkabau (Arabic script)	min_Arab
Minangkabau (Latin script)	min_Latn
Macedonian	mkd_Cyrl
Plateau Malagasy	plt_Latn
Maltese	mlt_Latn
Meitei (Bengali script)	mni_Beng
Halh Mongolian	khk_Cyrl
Mossi	mos_Latn
Maori	mri_Latn
Burmese	mya_Mymr
Dutch	nld_Latn
Norwegian Nynorsk	nno_Latn
Norwegian Bokmål	nob_Latn
Nepali	npi_Deva
Northern Sotho	nso_Latn
Nuer	nus_Latn
Nyanja	nya_Latn
Occitan	oci_Latn
West Central Oromo	gaz_Latn
Odia	ory_Orya
Pangasinan	pag_Latn
Eastern Panjabi	pan_Guru
Papiamento	pap_Latn
Western Persian	pes_Arab
Polish	pol_Latn
Portuguese	por_Latn
Dari	prs_Arab
Southern Pashto	pbt_Arab
Ayacucho Quechua	quy_Latn
Romanian	ron_Latn
Rundi	run_Latn
Russian	rus_Cyrl
Sango	sag_Latn
Sanskrit	san_Deva
Santali	sat_Olck
Sicilian	scn_Latn
Shan	shn_Mymr
Sinhala	sin_Sinh
Slovak	slk_Latn
Slovenian	slv_Latn
Samoan	smo_Latn
Shona	sna_Latn
Sindhi	snd_Arab
Somali	som_Latn
Southern Sotho	sot_Latn
Spanish	spa_Latn
Tosk Albanian	als_Latn
Sardinian	srd_Latn
Serbian	srp_Cyrl
Swati	ssw_Latn
Sundanese	sun_Latn
Swedish	swe_Latn
Swahili	swh_Latn
Silesian	szl_Latn
Tamil	tam_Taml
Tatar	tat_Cyrl
Telugu	tel_Telu
Tajik	tgk_Cyrl
Tagalog	tgl_Latn
Thai	tha_Thai
Tigrinya	tir_Ethi
Tamasheq (Latin script)	taq_Latn
Tamasheq (Tifinagh script)	taq_Tfng
Tok Pisin	tpi_Latn
Tswana	tsn_Latn
Tsonga	tso_Latn
Turkmen	tuk_Latn
Tumbuka	tum_Latn
Turkish	tur_Latn
Twi	twi_Latn
Central Atlas Tamazight	tzm_Tfng
Uyghur	uig_Arab
Ukrainian	ukr_Cyrl
Umbundu	umb_Latn
Urdu	urd_Arab
Northern Uzbek	uzn_Latn
Venetian	vec_Latn
Vietnamese	vie_Latn
Waray	war_Latn
Wolof	wol_Latn
Xhosa	xho_Latn
Eastern Yiddish	ydd_Hebr
Yoruba	yor_Latn
Yue Chinese	yue_Hant
Chinese (Simplified)	zho_Hans
Chinese (Traditional)	zho_Hant
Standard Malay	zsm_Latn
Zulu	zul_Latn
`.trim().split('\n');

for (let i = 0; i < languageData.length; i++) {
    const line = languageData[i];
    languageData[i] = {
        name: line.substring(0, line.lastIndexOf("	")).trim(),
        value: line.substring(line.lastIndexOf("	")).trim()
    }
}


//Ignore ts(80001)
const { SlashCommandBuilder, CommandInteraction, Message, ChannelType } = require('discord.js');
const { Translate } = require('../VoiceV2');
const { client } = require('..');

const TranslatingLists = [
    {
        inputId: 1234,
        outputId: 1234,
        to: "lang_code",
        from: "lang_code"
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('translate')
        .setDescription("Translates text in various ways.")
        .addSubcommand(o => {
            return o.setName("text")
                .setDescription("Translates text.")
                .addStringOption(p => {
                    return p.setName("text")
                        .setDescription("text to translate")
                        .setRequired(true)
                })
                .addStringOption(p => {
                    return p.setName("to")
                        .setDescription("langauge to translate to")
                        .setRequired(false)
                        .setAutocomplete(true);
                })
                .addStringOption(p => {
                    return p.setName("from")
                        .setDescription("langauge to translate from")
                        .setRequired(false)
                        .setAutocomplete(true);
                })
        })
        .addSubcommand(o => {
            return o.setName("convo")
                .setDescription("Translates a conversation.")
                .addStringOption(p => {
                    return p.setName("to")
                        .setDescription("langauge to translate to")
                        .setRequired(true)
                        .setAutocomplete(true);
                })
                .addStringOption(p => {
                    return p.setName("from")
                        .setDescription("langauge to translate from")
                        .setRequired(true)
                        .setAutocomplete(true);
                })
                .addChannelOption(p => {
                    return p.setName("input")
                        .setDescription("channel to translate from")
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread, ChannelType.GuildAnnouncement);
                })
                .addChannelOption(p => {
                    return p.setName("output")
                        .setDescription("channel to translate into")
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread, ChannelType.GuildAnnouncement);
                })
        })
        .addSubcommand(o => {
            return o.setName("stopconvo")
                .setDescription("Stops translating a conversation.")
                .addChannelOption(p => {
                    return p.setName("output")
                        .setDescription("channel to translate into")
                        .setRequired(false)
                        .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread, ChannelType.GuildAnnouncement);
                })
        }),

    /**
     * Generates the message with the specified count.
     * @param {CommandInteraction} interaction 
     */
    async execute(interaction) {
        // Defer for safety.
        await interaction.deferReply();

        const subcommand = await interaction.options.getSubcommand();

        // Get common options.
        const to = interaction.options.getString("to") ?? languageData[0].value;
        const from = interaction.options.getString("from") ?? languageData[0].value;

        if (subcommand == "text") {
            const text = interaction.options.getString("text");

            Translate(text, to, from).then(v => {
                let suffix = "";
                if (from == "auto") suffix = `\nOriginal Language:\`${v.from_lang}\``
                interaction.editReply(`Translation: \`${v.translation_text}\`\nOriginal: \`${text}\`` + suffix);
            })
        } else if (subcommand == "convo") {
            // Don't allow this to be run externally.
            if (interaction.guild == undefined) return interaction.editReply("This command cannot be run externally!");

            // Add to list.
            for (let i = 0; i < TranslatingLists.length; i++) if (TranslatingLists[i].inputId == interaction.channelId) 
                return interaction.editReply("This set already exists!");

            const input = interaction.options.getChannel("input") ?? interaction.channel;
            const output = interaction.options.getChannel("output") ?? interaction.channel;

            const data = {
                inputId: input.id,
                outputId: output.id,
                to: to,
                from: from
            }

            TranslatingLists.push(data);
            
            interaction.editReply("Started translating!");
        } else if (subcommand == "stopconvo") {
            const output = interaction.options.getChannel("output") ?? interaction.channel;
            for (let i = 0; i < TranslatingLists.length; i++) if (TranslatingLists[i].outputId == output.id) {
                TranslatingLists.splice(i, 1);
            }

            interaction.editReply("Stopped translating!");
        }
    },

    // Below here is not required; should be deleted if not needed.
    /**
     * Executes code when message is recieved.
     * @param {Message} message The inputted message. 
     */
    async OnMessageRecieved(message) {
        // Ignore bots and empty messages
        if (message.author.bot || (message.content ?? "").trim().length == 0) return;

        for (let i = 0; i < TranslatingLists.length; i++) {
            const CurrentList = TranslatingLists[i];
            if (message.channelId == CurrentList.inputId) {
                // Translate it to the list's langauge and send it.
                Translate(message.content, CurrentList.to, CurrentList.from).then(async v => {
                    (await client.channels.fetch(CurrentList.outputId)).send(`${message.author.displayName} | ${v.translation_text}`);
                })
            }
        }
    },

    /** 
     * Variable which determines if this command can be used as a user install app.
     * Should be set to false if can't be used. If not defined, then it's assumed to be true.
     * @default {true}
     */
    CanExternal: true,

    /**
     * @param {AutocompleteInteraction} interaction The Autocomplete request.
     */
    async OnAutocomplete(interaction) {        
        // Get what the user has currently typed in.
        const stringValue = interaction.options.getFocused();
        
        // Filter to just matching ones. Also, cut off if we have more than twenty responses.
		let filtered = languageData.filter(choice => choice.name.toLowerCase().startsWith(stringValue.toLowerCase()));
        if (filtered.length > 20) filtered = filtered.slice(0, 20);

        // If the automatic option isn't in the list, replace the last one.
        /* if (filtered.indexOf(languageData[0]) == -1) {
            filtered[20] = languageData[0] // Automatic.
        } */
		
        // Send back our response.
        await interaction.respond(filtered);
    }
}
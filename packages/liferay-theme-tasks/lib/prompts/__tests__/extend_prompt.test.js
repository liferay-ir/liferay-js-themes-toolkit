/**
 * © 2017 Liferay, Inc. <https://liferay.com>
 *
 * SPDX-License-Identifier: MIT
 */

const _ = require('lodash');
const sinon = require('sinon');

const lfrThemeConfig = require('../../liferay_theme_config.js');
const testUtil = require('../../../test/util.js');

const assertBoundFunction = testUtil.assertBoundFunction;
const prototypeMethodSpy = new testUtil.PrototypeMethodSpy();

const initCwd = process.cwd();
const liferayVersion = '7.0';
const liferayThemeThemletMetaData = {
	themelet: true,
	version: liferayVersion,
};
const themeletDependencies = {
	'themelet-1': {
		liferayTheme: liferayThemeThemletMetaData,
		name: 'themelet-1',
		realPath: 'path/to/themelet-1',
		version: liferayVersion,
	},
	'themelet-2': {
		liferayTheme: liferayThemeThemletMetaData,
		name: 'themelet-2',
		realPath: 'path/to/themelet-2',
		version: liferayVersion,
	},
	'themelet-3': {
		liferayTheme: liferayThemeThemletMetaData,
		name: 'themelet-3',
		realPath: 'path/to/themelet-3',
		version: liferayVersion,
	},
};

let ExtendPrompt;
let prototype;

beforeEach(() => {
	testUtil.copyTempTheme({
		namespace: 'extend_prompt',
	});

	ExtendPrompt = require('../extend_prompt');
	prototype = _.create(ExtendPrompt.prototype);
	prototype.themeConfig = lfrThemeConfig.getConfig();
});

afterEach(() => {
	ExtendPrompt.prototype._extendableThemes = undefined;
	ExtendPrompt.prototype._extendType = undefined;
	prototypeMethodSpy.flush();

	testUtil.cleanTempTheme('base-theme', '7.1', 'extend_prompt', initCwd);
});

it('_afterPromptModule should use after method which corresponds to addedThemelets properties of answers', () => {
	const answers = {
		module: 'Test',
	};

	prototype._afterPromptTheme = sinon.spy();
	prototype._afterPromptThemelets = sinon.spy();

	prototype._afterPromptModule(answers);

	expect(prototype._afterPromptTheme.calledWith(answers)).toBe(true);
	expect(prototype._afterPromptThemelets.callCount).toBe(0);

	answers.addedThemelets = ['some-themelet'];

	prototype._afterPromptModule(answers);

	expect(prototype._afterPromptThemelets.calledWith(answers)).toBe(true);
	expect(prototype._afterPromptTheme.callCount).toBe(1);
});
//
it('_afterPromptTheme should save and install new dependencies', () => {
	const removeDependencies = lfrThemeConfig.removeDependencies;
	const setConfig = lfrThemeConfig.setConfig;

	lfrThemeConfig.removeDependencies = sinon.spy();
	lfrThemeConfig.setConfig = sinon.spy();
	prototype._installDependencies = sinon.spy();
	prototype._saveDependencies = sinon.spy();

	const answers = {
		module: 'some-theme',
		modules: {
			'some-theme': {
				liferayTheme: {
					baseTheme: 'styled',
					screenshot: '',
					templateLanguage: 'ftl',
					version: '7.0',
					themeletDependencies: {},
				},
				name: 'some-theme',
				publishConfig: {
					tag: '7_0_x',
				},
				version: '1.0.0',
			},
		},
	};

	prototype._afterPromptTheme(answers);

	expect(lfrThemeConfig.removeDependencies.calledWith(['parent-theme'])).toBe(
		true
	);

	const setConfigArgs = lfrThemeConfig.setConfig.getCall(0).args[0];

	expect(_.isObject(setConfigArgs.baseTheme.liferayTheme)).toBe(true);
	expect(setConfigArgs.baseTheme.version).toBe('1.0.0');

	expect(
		prototype._saveDependencies.calledWith([setConfigArgs.baseTheme])
	).toBe(true);

	expect(
		prototype._installDependencies.calledWith([setConfigArgs.baseTheme])
	).toBe(true);

	lfrThemeConfig.removeDependencies = removeDependencies;
	lfrThemeConfig.setConfig = setConfig;
});

it('_afterPromptTheme should end task and not throw error if no module was found', done => {
	prototype.done = done;

	prototype._afterPromptTheme({
		module: null,
		modules: {},
	});
});

it('_afterPromptThemelets should remove unchecked themelets from package.json and save new themelet dependencies', () => {
	const removeDependencies = lfrThemeConfig.removeDependencies;
	const setConfig = lfrThemeConfig.setConfig;

	lfrThemeConfig.removeDependencies = sinon.spy();
	lfrThemeConfig.setConfig = sinon.spy();
	prototype._installDependencies = sinon.spy();
	prototype._saveDependencies = sinon.spy();

	prototype.themeConfig.themeletDependencies = _.assign(
		{},
		{
			'themelet-1': prototype._reducePkgData(
				themeletDependencies['themelet-1']
			),
			'themelet-2': prototype._reducePkgData(
				themeletDependencies['themelet-2']
			),
		}
	);

	const answers = {
		addedThemelets: ['themelet-3'],
		modules: themeletDependencies,
		removedThemelets: ['themelet-1'],
	};

	prototype._afterPromptThemelets(answers);

	expect(lfrThemeConfig.removeDependencies.calledWith(['themelet-1'])).toBe(
		true
	);

	const reducedThemelets = {
		'themelet-2': prototype._reducePkgData(
			themeletDependencies['themelet-2']
		),
		'themelet-3': prototype._reducePkgData(
			themeletDependencies['themelet-3']
		),
	};

	expect(
		lfrThemeConfig.setConfig.calledWith({
			themeletDependencies: reducedThemelets,
		})
	).toBe(true);

	expect(prototype._saveDependencies.calledWith(reducedThemelets)).toBe(true);

	expect(prototype._installDependencies.calledWith(reducedThemelets)).toBe(
		true
	);

	lfrThemeConfig.removeDependencies = removeDependencies;
	lfrThemeConfig.setConfig = setConfig;
});

it('_afterPromptThemeSource should set base theme if styled/unstyled', () => {
	const answers = {
		themeSource: 'styled',
	};

	prototype._setStaticBaseTheme = sinon.spy();

	prototype._afterPromptThemeSource(answers);

	expect(prototype._setStaticBaseTheme.getCall(0).calledWith('styled')).toBe(
		true
	);

	answers.themeSource = 'unstyled';

	prototype._afterPromptThemeSource(answers);

	expect(
		prototype._setStaticBaseTheme.getCall(1).calledWith('unstyled')
	).toBe(true);
});

it('_afterPromptThemeSource should call GlobalModulePrompt', () => {
	const GlobalModulePrompt = require('../global_module_prompt');

	const answers = {
		themeSource: 'global',
	};

	const initSpy = prototypeMethodSpy.add(
		GlobalModulePrompt.prototype,
		'init'
	);

	prototype._afterPromptModule = sinon.spy();

	prototype._afterPromptThemeSource(answers);

	const args = initSpy.getCall(0).args;

	expect(args[0]).toEqual({
		selectedModules: ['parent-theme'],
		themelet: false,
	});

	args[1]();

	expect(prototype._afterPromptModule.calledOnce).toBe(true);
});

it('_afterPromptThemeSource should call NPMModulePrompt', () => {
	const NPMModulePrompt = require('../npm_module_prompt');

	const answers = {
		themeSource: 'npm',
	};

	const initSpy = prototypeMethodSpy.add(NPMModulePrompt.prototype, 'init');

	prototype._afterPromptModule = sinon.spy();

	prototype._afterPromptThemeSource(answers);

	const args = initSpy.getCall(0).args;

	expect(args[0]).toEqual({
		selectedModules: ['parent-theme'],
		themelet: false,
	});

	args[1]();

	expect(prototype._afterPromptModule.calledOnce).toBe(true);
});

it('_filterExtendType should set _extendType to input arg', () => {
	prototype._filterExtendType('theme');

	expect(prototype._extendType).toBe('theme');

	prototype._filterExtendType('themelet');

	expect(prototype._extendType).toBe('themelet');
});

it('_getDependencyInstallationArray should return absolute path if present or name of module', () => {
	const dependencies = prototype._getDependencyInstallationArray({
		'themelet-1': {
			liferayTheme: {
				themelet: true,
				version: '*',
			},
			name: 'themelet-1',
			version: '1.0',
		},
		'themelet-2': {
			liferayTheme: {
				themelet: true,
				version: '*',
			},
			name: 'themelet-2',
			path: 'path/to/themelet-2',
			version: '1.0',
		},
		'themelet-3': {
			liferayTheme: {
				themelet: true,
				version: '7.1',
			},
			name: 'themelet-3',
			publishConfig: {
				tag: '7_1_x',
			},
			version: '1.0',
		},
	});

	expect(dependencies).toEqual([
		'themelet-1@*',
		'path/to/themelet-2',
		'themelet-3@7_1_x',
	]);
});

it('_getSelectedModules should pass', () => {
	prototype.themeConfig = {
		baseTheme: 'styled',
		themeletDependencies,
	};

	expect(prototype._getSelectedModules(true)).toEqual([
		'themelet-1',
		'themelet-2',
		'themelet-3',
	]);

	expect(prototype._getSelectedModules(false)).toBeUndefined();

	prototype.themeConfig.baseTheme = {
		name: 'parent-theme',
	};

	expect(prototype._getSelectedModules(false)).toEqual(['parent-theme']);
});

it('_getThemeSourceChoices should return different choices based on _extendType property', () => {
	let choices = prototype._getThemeSourceChoices();

	expect(choices.length).toBe(2);

	prototype._extendType = 'theme';

	choices = prototype._getThemeSourceChoices();

	expect(choices).toHaveLength(5);
});

it('_getThemeSourceMessage should return appropriate message based on _extendType property', () => {
	let message = prototype._getThemeSourceMessage();

	expect(message).toBe('Where would you like to search for themelets?');

	prototype._extendType = 'theme';

	message = prototype._getThemeSourceMessage();

	expect(message).toBe('What base theme would you like to extend?');
});

it('_hasPublishTag should return true if publish tag exists', () => {
	expect(
		!prototype._hasPublishTag({
			publishConfig: {},
		})
	).toBe(true);

	expect(
		prototype._hasPublishTag({
			publishConfig: {
				tag: '7_0_x',
			},
		})
	).toBeTruthy();
});

it('_installDependencies should run child process that installs dependencies', done => {
	prototype._installDependencies(
		themeletDependencies,
		(err, _data) => {
			if (err.cmd) {
				expect(
					err.cmd.indexOf(
						'npm install themelet-1@* themelet-2@* themelet-3@*'
					) > -1
				).toBe(true);
			}

			done();
		},
		true
	);
});

it('_isSupported should validate version', () => {
	const version = '2.0';

	expect(!prototype._isSupported('1.0', version)).toBe(true);
	expect(!prototype._isSupported(['1.0'], version)).toBe(true);
	expect(prototype._isSupported(['1.0', version], version)).toBe(true);
	expect(prototype._isSupported(version, version)).toBe(true);
});

it('_promptThemeSource should prompt correct workflow', () => {
	const inquirer = require('inquirer');

	const prompt = inquirer.prompt;

	inquirer.prompt = sinon.spy();
	prototype._afterPromptThemeSource = sinon.spy();

	const assertFilterExtendType = assertBoundFunction(
		prototype,
		'_filterExtendType'
	);
	const assertGetThemeSourceChoices = assertBoundFunction(
		prototype,
		'_getThemeSourceChoices'
	);
	const assertGetThemeSourceMessage = assertBoundFunction(
		prototype,
		'_getThemeSourceMessage'
	);

	prototype._promptThemeSource();

	const args = inquirer.prompt.getCall(0).args;
	const questions = args[0];

	const extendType = questions[0];

	expect(extendType.name).toBe('extendType');
	assertFilterExtendType(extendType.filter);

	const themeSource = questions[1];

	expect(themeSource.name).toBe('themeSource');

	assertGetThemeSourceChoices(themeSource.choices);
	assertGetThemeSourceMessage(themeSource.message);

	args[1]();

	expect(prototype._afterPromptThemeSource.calledOnce).toBe(true);

	inquirer.prompt = prompt;
});

it('_reducePkgData should reduce package data to specified set of properties', () => {
	const originalData = {
		liferayTheme: '7.0',
		name: 'name',
		version: '1.1.1',
		publishConfig: {
			tag: 'tag',
		},
		someProp: 'some-value',
	};

	let pkgData = prototype._reducePkgData(originalData);

	delete originalData.someProp;

	expect(pkgData).toEqual(originalData);

	pkgData = prototype._reducePkgData({
		realPath: '/some/path',
	});

	expect(pkgData.path).toEqual('/some/path');
});

it('_saveDependencies should save dependencies to package.json', () => {
	const updatedData = {
		'lfr-flat-tooltip-themelet': {
			liferayTheme: {
				themelet: true,
				version: '7.1',
			},
			name: 'lfr-flat-tooltip-themelet',
			publishConfig: {
				tag: '7_1_x',
			},
			version: '1.0.0',
		},
		'lfr-link-flip-themelet': {
			liferayTheme: {
				themelet: true,
				version: '*',
			},
			name: 'lfr-link-flip-themelet',
			version: '1.0.1',
		},
	};

	const setDependencies = lfrThemeConfig.setDependencies;

	lfrThemeConfig.setDependencies = sinon.spy();

	prototype._saveDependencies(updatedData);

	expect(lfrThemeConfig.setDependencies.callCount).toBe(1);
	expect(
		lfrThemeConfig.setDependencies.calledWith({
			'lfr-flat-tooltip-themelet': '7_1_x',
			'lfr-link-flip-themelet': '*',
		})
	).toBe(true);

	lfrThemeConfig.setDependencies = setDependencies;
});

it('_setStaticBaseTheme should set static base theme', () => {
	prototype.done = sinon.spy();
	prototype.themeConfig = {
		baseTheme: 'unstyled',
	};

	const setConfig = lfrThemeConfig.setConfig;
	const removeDependencies = lfrThemeConfig.removeDependencies;

	lfrThemeConfig.removeDependencies = sinon.spy();
	lfrThemeConfig.setConfig = sinon.spy();

	prototype._setStaticBaseTheme('styled');

	expect(
		lfrThemeConfig.setConfig.calledWith({
			baseTheme: 'styled',
		})
	).toBe(true);
	expect(lfrThemeConfig.removeDependencies.notCalled).toBe(true);

	prototype.themeConfig.baseTheme = {
		name: 'some-theme',
	};

	prototype._setStaticBaseTheme('styled');

	expect(lfrThemeConfig.removeDependencies.calledWith(['some-theme'])).toBe(
		true
	);

	lfrThemeConfig.setConfig = setConfig;
	lfrThemeConfig.removeDependencies = removeDependencies;
});

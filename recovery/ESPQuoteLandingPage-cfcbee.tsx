import { isDateAfter } from '@embroker/service-app-engine';
import { container } from '@embroker/shotwell/core/di';
import { InvalidArgument } from '@embroker/shotwell/core/Error';
import { DomainEventBus } from '@embroker/shotwell/core/event/DomainEventBus';
import { Log, Logger } from '@embroker/shotwell/core/logging/Logger';
import { Immutable } from '@embroker/shotwell/core/types';
import { Money } from '@embroker/shotwell/core/types/Money';
import { cast } from '@embroker/shotwell/core/types/Nominal';
import { Failure, isErr, isOK, Success } from '@embroker/shotwell/core/types/Result';
import { URI } from '@embroker/shotwell/core/types/URI';
import { UUID } from '@embroker/shotwell/core/types/UUID';
import { execute } from '@embroker/shotwell/core/UseCase';
import { Joi } from '@embroker/shotwell/core/validation/schema';
import { createForm, OpaqueForm } from '@embroker/shotwell/view/hooks/useForm';
import { useUseCase } from '@embroker/shotwell/view/hooks/useUseCase';
import { useModal } from '@embroker/ui-toolkit/v2';
import { startOfToday } from 'date-fns';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SKU } from '../../../../analytics/types/SKU';
import { EditApplication } from '../../../../brokerDashboard/useCases/EditApplication';
import { QuotingEngineESP } from '../../../../shopping/types/enums';
import { PurchasedAppType } from '../../../../summary/types/PurchasedAppType';
import { hasRole } from '../../../../userOrg/entities/Session';
import { AppContext } from '../../../../view/AppContext';
import { NavigateFunction, useNavigation } from '../../../../view/hooks/useNavigation';
import { useWizardForm, WizardPages } from '../../../../view/hooks/useWizardForm';
import { GetSignaturePacketFileUrl } from '../../../brokerage/useCases/GetSignaturePacketFileUrl';
import { RequestHigherLimits } from '../../../brokerage/useCases/RequestHigherLimits';
import { BrokerSignaturePage } from '../../../brokerage/view/components/BrokerSignaturePage';
import { QuoteBindCoverage } from '../../../entities/Quote';
import {
    ESPGeneralTermsAndConditionsPlusNewInsurerURL,
    ESPGeneralTermsAndConditionsPlusURL,
    ESPGeneralTermsAndConditionsStandardNewInsurerURL,
    ESPGeneralTermsAndConditionsStandardURL,
} from '../../../espUtils/constants';
import { DraftQuote } from '../../../useCases/DraftQuote';
import { ReferQuote } from '../../../useCases/ReferQuote';
import { SignQuote } from '../../../useCases/SignQuote';
import { UnsignQuote } from '../../../useCases/UnsignQuote';
import { DownloadQuoteButton } from '../../../view/components/DownloadQuoteButton';
import { DownloadSignaturePacketButton } from '../../../view/components/DownloadSignaturePacketButton';
import { EditApplicationButton } from '../../../view/components/EditApplicationButton';
import { validateEffectiveDate } from '../../../view/components/formValidators';
import {
    MenuItem,
    Page,
    PageNavigationComponent,
    QuoteLandingPage,
} from '../../../view/components/QuoteLandingPage';
import { QuoteOnDemandNavigation } from '../../../view/components/QuoteOnDemandNavigation';
import { ReferredQuoteOnDemandNavigation } from '../../../view/components/ReferredQuoteOnDemandNavigation';
import { withExtraProps } from '../../../view/components/WithExtraProps';
import { ESPQuote } from '../../entities/ESPQuote';
import { CoverageType } from '../../types/CoverageRestriction';
import { ESPQuoteOptions } from '../../types/ESPQuoteOptions';
import { ESPCoverageRateItem, ESPEoCyberCoverageRateItem } from '../../types/ESPRate';
import { InsuranceApplicationRestriction } from '../../types/InsuranceApplicationRestriction';
import { DownloadESPQuoteDocument } from '../../useCases/DownloadESPQuoteDocument';
import { ESPRequestHigherLimits } from '../../useCases/ESPRequestHigherLimits';
import { GetESPQuestionnaireData } from '../../useCases/GetESPQuestionnaireData';
import { GetInitialESPRate } from '../../useCases/GetInitialESPRate';
import { GetRestriction } from '../../useCases/GetRestriction';
import { PurchaseESP } from '../../useCases/PurchaseESP';
import { RequoteESP } from '../../useCases/RequoteESP';
import { DownloadESPGTCButton } from './DownloadESPGTCButton';
import { ESPCoveragesPage } from './ESPCoveragesPage/ESPCoveragesPage';
import { HigherLimitModal } from './ESPHigherLimitModal';
import { ESPQuoteBreakdown } from './ESPQuoteBreakdown';
import { ESPQuoteSummary } from './ESPQuoteSummary';
import { EspReferredNavigation } from './EspReferredNavigation';
import { QuoteSignature } from './Signature/QuoteSignature';

export interface ESPQuoteOptionsFormData {
    // Used for cross-fields validation with it's validation message displayed
    // in specific location of the page.
    // We need any type, other than undefined, to allow custom cross-fields
    // validation to kick in.
    coverage: 'any but undefined';

    isDnoSelected: boolean;
    dnoLevel?: 'standard' | 'plus';
    dnoLimit: number;
    dnoRetention: number;

    isEplSelected: boolean;
    eplLevel?: 'standard' | 'plus';
    eplLimit: number;
    eplRetention: number;

    fiduciaryLimit: number;
    fiduciaryRetention: number;
    isFiduciarySelected: boolean;

    isEoSelected: boolean;
    eoLevel: 'standard' | 'plus';
    eoLimit: number;
    eoRetention: number;

    startDate?: Date;

    partnerCode: string;
    agreementToConductSignature: boolean;
    warrantyAndFraudSignature: boolean;

    brokerSignature: boolean;
}

const extractCoverage = (
    coverages: Immutable<Array<ESPCoverageRateItem>> | undefined,
    coverageType: string,
) => {
    if (!coverages) {
        return undefined;
    }
    return coverages.find((coverage) => {
        return coverage.coverageType == coverageType;
    });
};

const mapToCoverageRestrictionCoverageType = (coverageType: string): CoverageType => {
    switch (coverageType) {
        case 'do':
            return 'ShoppingCoverageCodeListDirectorsAndOfficers';
        case 'epli':
            return 'ShoppingCoverageCodeListEmploymentPractices';
        case 'fiduciary':
            return 'ShoppingCoverageCodeListFiduciary';
        default:
            return 'ShoppingCoverageCodeListCyber';
    }
};

const checkHigherLimits = (
    quote: ESPQuote,
    restrictions?: Immutable<InsuranceApplicationRestriction>,
) => {
    let isHigherLimitsQuote = false;
    quote.details.coverages.some((coverage) => {
        const maxLimit = restrictions?.coverageRestrictions.find(
            (coverageRestriction) =>
                coverageRestriction.coverageType ===
                mapToCoverageRestrictionCoverageType(coverage.coverageType),
        )?.maxLimit;
        const maxLimitInDollars = maxLimit ? Money.toFloat(maxLimit) : 3000000;
        if (coverage.selected && coverage.limit > maxLimitInDollars) {
            isHigherLimitsQuote = true;
        }
    });
    return isHigherLimitsQuote;
};

const fromQuoteToQuoteOptions = (quote: ESPQuote): ESPQuoteOptions => ({
    effectiveDate: quote.options.effectiveDate,
    partnerCode: quote.details.partnerCode,
    coverages: quote.details.coverages,
});

const formDataToQuoteOptions = (
    formData: ESPQuoteOptionsFormData,
    disablePartnerCode = false,
): ESPQuoteOptions => ({
    effectiveDate: formData.startDate as Date, // We know the form will set a date
    partnerCode: disablePartnerCode ? '' : formData.partnerCode ?? '',
    coverages: [
        {
            coverageType: 'do',
            limit: formData.dnoLimit,
            retention: formData.dnoRetention,
            selected: formData.isDnoSelected,
            level: formData.dnoLevel,
        },
        {
            coverageType: 'epli',
            limit: formData.eplLimit,
            retention: formData.eplRetention,
            selected: formData.isEplSelected,
            level: formData.eplLevel,
        },
        {
            coverageType: 'fiduciary',
            selected: formData.isFiduciarySelected,
            limit: 1000000,
            retention: 0,
        },
        {
            coverageType: 'eoCyber',
            selected: formData.isEoSelected,
            limit: formData.eoLimit,
            retention: formData.eoRetention,
            level: formData.eoLevel,
        },
    ],
});

export const MAX_FUTURE_DAYS_ALLOWED = 90;

const createESPQuoteOptionsForm = (
    quote: ESPQuote | undefined,
    abortSignal: AbortSignal,
    isBroker: boolean,
    isAdmin: boolean,
    setQuote: (quote: ESPQuote) => void,
    navigate: NavigateFunction,
    disablePartnerCode?: boolean,
) => {
    return createForm<ESPQuoteOptionsFormData>({
        fields: {
            coverage: {
                type: 'hidden',
                validator: Joi.string()
                    .custom((value, { prefs: { context }, error }) => {
                        if (
                            context === undefined ||
                            context.isDnoSelected ||
                            context.isEoSelected ||
                            context.isEplSelected ||
                            context.isFiduciarySelected
                        ) {
                            return value;
                        }

                        return error('custom.noCoverageSelected');
                    })
                    .required(),
                formatValidationError: (error) => {
                    switch (error.details.validator) {
                        case 'custom.noCoverageSelected':
                            return 'Please select your coverage.';
                        default:
                            return error.message;
                    }
                },
            },
            isDnoSelected: {
                type: 'hidden',
                validator: Joi.boolean().required(),
            },
            dnoLimit: {
                type: 'select',
                validator: Joi.number().required(),
            },
            dnoRetention: {
                type: 'select',
                validator: Joi.number().required(),
            },
            dnoLevel: {
                type: 'radioGroup',
                validator: Joi.string().valid('standard', 'plus').optional(),
            },
            isEoSelected: {
                type: 'hidden',
                validator: Joi.boolean().required(),
            },
            eoLimit: {
                type: 'select',
                validator: Joi.number().required(),
            },
            eoRetention: {
                type: 'select',
                validator: Joi.number().required(),
            },
            eoLevel: {
                type: 'radioGroup',
                validator: Joi.string().valid('standard', 'plus').required(),
            },
            fiduciaryLimit: {
                type: 'select',
                validator: Joi.number().required(),
            },
            fiduciaryRetention: {
                type: 'select',
                validator: Joi.number().required(),
            },
            isFiduciarySelected: {
                type: 'hidden',
                validator: Joi.boolean().required(),
            },
            isEplSelected: {
                type: 'hidden',
                validator: Joi.boolean().required(),
            },
            eplLimit: {
                type: 'select',
                validator: Joi.number().required(),
            },
            eplRetention: {
                type: 'select',
                validator: Joi.number().required(),
            },
            eplLevel: {
                type: 'radioGroup',
                validator: Joi.string().valid('standard', 'plus').optional(),
            },
            partnerCode: {
                type: 'text',
                validator: Joi.string().allow(''),
            },
            startDate: {
                type: 'date',
                validator: Joi.date()
                    .custom((value, helpers) => {
                        return validateEffectiveDate(
                            value,
                            startOfToday(),
                            MAX_FUTURE_DAYS_ALLOWED,
                            helpers,
                            isAdmin,
                        );
                    })
                    .required(),
                formatValidationError: (error) => {
                    switch (error.details.validator) {
                        case 'date.min':
                            return 'Effective date cannot be in the past.';
                        case 'date.max':
                            return 'Effective date cannot be more than ninety days in the future.';
                        default:
                            return error.message;
                    }
                },
            },
            agreementToConductSignature: {
                type: 'checkbox',
                validator: Joi.boolean().custom((value, helpers) => {
                    return (
                        isBroker || value || helpers.error('agreementToConductSignature.invalid')
                    );
                }),
            },
            warrantyAndFraudSignature: {
                type: 'checkbox',
                validator: Joi.boolean().custom((value, helpers) => {
                    return isBroker || value || helpers.error('warrantyAndFraudSignature.invalid');
                }),
            },
            brokerSignature: {
                type: 'hidden',
                validator: Joi.boolean().custom((value, helpers) => {
                    return !isBroker || value || helpers.error('brokerSignature.invalid');
                }),
            },
        },
        actions: {
            downloadSignaturePacket: {
                action: async () => {
                    if (!quote) {
                        return Failure(InvalidArgument({ argument: 'quote', value: quote }));
                    }

                    return await execute(GetSignaturePacketFileUrl, {
                        applicationId: quote.applicationId,
                        quoteId: quote.id,
                        abortSignal,
                    });
                },
                fields: ['startDate'],
            },
            requestHigherLimits: {
                action: async () => {
                    if (!quote) {
                        return Failure(InvalidArgument({ argument: 'quote', value: quote }));
                    }
                    if (!isBroker) {
                        return await execute(ESPRequestHigherLimits, {
                            applicationId: quote.applicationId,
                        });
                    }
                    return await execute(RequestHigherLimits, {
                        applicationId: quote.applicationId,
                    });
                },
                fields: ['startDate'],
            },
            update: {
                action: async (formData: ESPQuoteOptionsFormData) => {
                    if (!quote) {
                        return Failure(InvalidArgument({ argument: 'quote', value: quote }));
                    }

                    const quoteOptions = formDataToQuoteOptions(formData, disablePartnerCode);

                    return await execute(RequoteESP, {
                        applicationId: quote.applicationId,
                        espQuoteOptions: quoteOptions,
                        abortSignal,
                    });
                },
                fields: [
                    'coverage',
                    'startDate',
                    'dnoLimit',
                    'dnoRetention',
                    'dnoLevel',
                    'isDnoSelected',
                    'eplLimit',
                    'eplRetention',
                    'eplLevel',
                    'isEplSelected',
                    'isFiduciarySelected',
                    'fiduciaryLimit',
                    'fiduciaryRetention',
                    'isEoSelected',
                    'eoLimit',
                    'eoRetention',
                    'eoLevel',
                    'partnerCode',
                ],
            },
            sign: {
                action: async (formData: ESPQuoteOptionsFormData) => {
                    if (!quote) {
                        return Failure(InvalidArgument({ argument: 'quote', value: quote }));
                    }

                    if (
                        (isBroker && formData.brokerSignature) ||
                        (formData.agreementToConductSignature && formData.warrantyAndFraudSignature)
                    ) {
                        return execute(SignQuote, { quote });
                    }

                    if (quote.status === 'signed') {
                        return await execute(UnsignQuote, { quote });
                    }

                    return Success({ quote });
                },
                fields: [
                    'coverage',
                    'startDate',
                    'dnoLimit',
                    'dnoRetention',
                    'dnoLevel',
                    'isDnoSelected',
                    'eplLimit',
                    'eplRetention',
                    'eplLevel',
                    'isEplSelected',
                    'isFiduciarySelected',
                    'fiduciaryLimit',
                    'fiduciaryRetention',
                    'isEoSelected',
                    'eoLimit',
                    'eoRetention',
                    'eoLevel',
                    'partnerCode',
                ],
            },
            downloadQuote: {
                action: async () => {
                    if (!quote) {
                        return Failure(InvalidArgument({ argument: 'quote', value: quote }));
                    }

                    const quoteOptions = fromQuoteToQuoteOptions(quote);

                    return await execute(DownloadESPQuoteDocument, {
                        applicationId: quote.applicationId,
                        quoteId: quote.id,
                        espQuoteOptions: quoteOptions,
                        abortSignal: abortSignal,
                        fileKey: quote.fileKey,
                    });
                },
                fields: [
                    'coverage',
                    'startDate',
                    'dnoLimit',
                    'dnoRetention',
                    'dnoLevel',
                    'isDnoSelected',
                    'eplLimit',
                    'eplRetention',
                    'eplLevel',
                    'isEplSelected',
                    'isFiduciarySelected',
                    'fiduciaryLimit',
                    'fiduciaryRetention',
                    'isEoSelected',
                    'eoLimit',
                    'eoRetention',
                    'eoLevel',
                    'partnerCode',
                ],
            },
            downloadGTC: {
                action: async () => {
                    if (!quote) {
                        return Failure(InvalidArgument({ argument: 'quote', value: quote }));
                    }

                    const documentDownload = fromQuoteToESPDownloadDocument(quote);
                    const tempLink: HTMLElement = document.createElement('a');
                    tempLink.setAttribute('href', documentDownload.url);
                    tempLink.setAttribute('download', documentDownload.fileName);
                    tempLink.setAttribute('target', '_blank');
                    tempLink.click();
                    return Success();
                },
                fields: ['dnoLevel', 'eplLevel', 'eoLevel'],
            },
            editApplication: {
                action: async () => {
                    if (!quote) {
                        return Failure(InvalidArgument({ argument: 'quote', value: quote }));
                    }

                    return await execute(EditApplication, {
                        applicationId: quote.applicationId,
                    });
                },
                fields: ['startDate'],
            },
            default: async () => {
                if (!quote) {
                    return Failure(InvalidArgument({ argument: 'quote', value: quote }));
                }

                return await execute(PurchaseESP, {
                    quote,
                    abortSignal,
                });
            },
        },
        onSuccess: (value, action) => {
            switch (action) {
                case 'downloadSignaturePacket':
                    window.open(value.documentUrl as string, '_blank');
                    break;
                case 'update':
                    setQuote(value);
                    break;
                case 'requestHigherLimits':
                    if (!isBroker) {
                        navigate(URI.build('/summary'));
                    }
                    break;
                case 'sign':
                    setQuote(value.quote as ESPQuote);
                    break;
                case 'editApplication':
                    navigate(
                        URI.build('/shopping/application/basic-info', {
                            applicationId: quote?.applicationId,
                        }),
                    );
                    break;
                case 'default': {
                    if (isBroker) {
                        navigate(
                            URI.build('/broker/dashboard', {
                                applicationId: quote?.applicationId,
                            }),
                        );
                    } else {
                        const selectedCoverages: Array<string> = [];
                        quote?.details.coverages
                            .filter((coverage) => coverage.selected)
                            .forEach((coverage) => {
                                if (coverage.coverageType == 'do') {
                                    selectedCoverages.push('Directors and Officers');
                                }
                                if (coverage.coverageType == 'epli') {
                                    selectedCoverages.push('Employment Practices Liability');
                                }
                                if (coverage.coverageType == 'fiduciary') {
                                    selectedCoverages.push('Fiduciary');
                                }
                                if (coverage.coverageType == 'eoCyber') {
                                    selectedCoverages.push(
                                        'Professional Liability / Errors and Omissions',
                                    );
                                }
                            });

                        const purchasedAppType = PurchasedAppType.create({
                            appTypes: selectedCoverages,
                        });

                        let appTypes: string | undefined;

                        if (isOK(purchasedAppType)) {
                            const result = PurchasedAppType.encode(purchasedAppType.value);
                            if (isOK(result)) {
                                appTypes = result.value;
                            }
                        }

                        navigate(
                            URI.build('/summary', {
                                applicationId: quote?.applicationId,
                                quotingEngine: QuotingEngineESP,
                                appTypes,
                                ...value,
                            }),
                        );
                    }
                    break;
                }
                default:
                    break;
            }
        },
    });
};

const isPlus = (quote: ESPQuote | undefined) => {
    return !!quote?.details.coverages.find(
        (coverage) => coverage.level === 'plus' && coverage.selected,
    );
};

const fromQuoteToESPDownloadDocument = (quote: ESPQuote): { url: string; fileName: string } => {
    const url = getUrlBasedOnSubmittedDate(quote);
    const { [0]: fileName } = url.split('/').slice(-1);

    return {
        url,
        fileName,
    };
};

const getUrlBasedOnSubmittedDate = (quote: ESPQuote): string => {
    const newInsurerDocumentsReleaseDate = quote.quoteInfo?.newInsurerDocumentsReleaseDate;
    const submittedAt = quote.quoteInfo?.submittedAt;
    const isPlusSelected = isPlus(quote);

    if (newInsurerDocumentsReleaseDate !== undefined && submittedAt !== undefined) {
        if (isDateAfter(submittedAt, newInsurerDocumentsReleaseDate)) {
            return isPlusSelected
                ? ESPGeneralTermsAndConditionsPlusNewInsurerURL
                : ESPGeneralTermsAndConditionsStandardNewInsurerURL;
        }
    }
    return isPlusSelected
        ? ESPGeneralTermsAndConditionsPlusURL
        : ESPGeneralTermsAndConditionsStandardURL;
};

const disablePartnerCode = (restriction?: Immutable<InsuranceApplicationRestriction>): boolean => {
    return restriction?.disablePartnerCode ?? false;
};

export interface ESPQuoteLandingPageProps {
    applicationId: UUID;
    partnerCode?: string;
}

export function ESPQuoteLandingPage({ applicationId, partnerCode }: ESPQuoteLandingPageProps) {
    const [quote, setQuote] = useState<ESPQuote>();
    const { activeSession } = useContext(AppContext);
    const isBroker = hasRole(activeSession, 'broker');
    const isAdmin = hasRole(activeSession, 'admin');
    const eventBus = useMemo(() => container.get<DomainEventBus>(DomainEventBus), []);

    const [restriction, setRestriction] = useState<Immutable<InsuranceApplicationRestriction>>();
    const [higherLimitsRequested, setHigherLimitsRequested] = useState(false);
    const onSetHigherLimitsRequested = useCallback(() => {
        setHigherLimitsRequested(true);
    }, []);

    const abortController = useMemo(() => {
        return new AbortController();
    }, []);
    const { result: questionnaireData } = useUseCase(GetESPQuestionnaireData, {
        applicationId,
    });
    const [raisedFunding, setRaisedFunding] = useState<boolean>(false);

    const higherLimitModal = useModal();

    useEffect(() => {
        if (
            questionnaireData !== undefined &&
            isOK(questionnaireData) &&
            questionnaireData.value !== undefined
        ) {
            setRaisedFunding(questionnaireData.value.raisedFunding);
        }
        if (questionnaireData !== undefined && isErr(questionnaireData)) {
            container
                .get<Logger>(Log)
                .error('Questionnaire data fetch failed', questionnaireData.errors);
        }
    }, [questionnaireData, setRaisedFunding]);

    const handleBindCoverageEvent = useCallback(() => {
        if (quote) {
            const skus = SKU.getSKUFromESPQuoteOptions(quote, raisedFunding);
            const event: QuoteBindCoverage = {
                origin: 'Quote',
                name: 'BindCoverage',
                totalPremium: quote?.totalPayable,
                applicationId,
                createdAt: new Date(Date.now()),
                id: UUID.create(),
                skus,
                isRenewal: false,
            };
            eventBus.publish(event);
        }
    }, [applicationId, eventBus, quote, raisedFunding]);

    useEffect(() => {
        return () => {
            abortController.abort();
        };
    }, [abortController]);

    useEffect(() => {
        let isCanceled = false;
        execute(GetRestriction, {
            insuranceApplicationId: applicationId,
        })
            .then((result) => {
                if (isCanceled) {
                    return;
                }

                if (isOK(result)) {
                    setRestriction(result.value.restriction);
                } else {
                    setRestriction(undefined);
                }
            })
            .catch(() => {
                if (isCanceled) {
                    return;
                }
            });
        return () => {
            isCanceled = true;
        };
    }, [applicationId, quote]);

    const { result: getQuoteResult } = useUseCase(GetInitialESPRate, {
        applicationId,
        abortSignal: abortController.signal,
        partnerCode,
    });

    useEffect(() => {
        if (getQuoteResult !== undefined && isOK(getQuoteResult)) {
            setQuote(getQuoteResult.value);
        }
    }, [getQuoteResult]);

    useEffect(() => {
        let isCanceled = false;
        if (quote && quote.status === 'draft') {
            if (checkHigherLimits(quote, restriction)) {
                execute(ReferQuote, { quote }).then((result) => {
                    if (isCanceled) {
                        return;
                    }
                    if (isOK(result)) {
                        setQuote(result.value.quote as ESPQuote);
                    }
                });
            }
        }
        return () => {
            isCanceled = true;
        };
    }, [quote, restriction]);

    const { navigate } = useNavigation();

    const optionsForm = useMemo(
        () =>
            createESPQuoteOptionsForm(
                quote,
                abortController.signal,
                isBroker,
                isAdmin,
                setQuote,
                navigate,
                disablePartnerCode(restriction),
            ),
        [quote, navigate, isBroker, isAdmin, abortController.signal, restriction],
    );

    const dnoCoverage = useMemo(() => extractCoverage(quote?.details.coverages, 'do'), [quote]);
    const eplCoverage = useMemo(() => extractCoverage(quote?.details.coverages, 'epli'), [quote]);
    const eoCoverage = useMemo(
        () => extractCoverage(quote?.details.coverages, 'eoCyber') as ESPEoCyberCoverageRateItem,
        [quote],
    );
    const fiduciaryCoverage = useMemo(
        () => extractCoverage(quote?.details.coverages, 'fiduciary'),
        [quote],
    );

    const initialValue: ESPQuoteOptionsFormData = {
        coverage: 'any but undefined',
        isDnoSelected: dnoCoverage?.selected ?? false,
        dnoLimit: dnoCoverage?.limit ?? 1000000,
        dnoRetention: dnoCoverage?.retention ?? 10000,
        dnoLevel: dnoCoverage?.level,
        isEplSelected: eplCoverage?.selected ?? false,
        eplLimit: eplCoverage?.limit ?? 1000000,
        eplRetention: eplCoverage?.retention ?? 10000,
        eplLevel: eplCoverage?.level,
        isEoSelected: eoCoverage?.selected ?? false,
        eoLimit: eoCoverage?.limit ?? 1000000,
        eoRetention: eoCoverage?.retention ?? 2500,
        eoLevel: eoCoverage?.level ?? 'plus',
        isFiduciarySelected: fiduciaryCoverage?.selected ?? false,
        fiduciaryLimit: 1000000,
        fiduciaryRetention: 0,
        startDate: quote?.details.effectiveDate,
        partnerCode:
            (disablePartnerCode(restriction) ? '' : quote?.details.partnerCode || partnerCode) ??
            '',
        agreementToConductSignature: false,
        warrantyAndFraudSignature: false,
        brokerSignature: false,
    };

    const quotePage = {
        name: 'coverage',
        fields: [
            'coverage',
            'startDate',
            'dnoLimit',
            'dnoRetention',
            'dnoLevel',
            'isDnoSelected',
            'eplLimit',
            'eplRetention',
            'eplLevel',
            'isEplSelected',
            'isFiduciarySelected',
            'fiduciaryLimit',
            'fiduciaryRetention',
            'isEoSelected',
            'eoLimit',
            'eoRetention',
            'eoLevel',
            'partnerCode',
        ],
    };
    const signPage = {
        name: 'signature',
        fields: isBroker
            ? ['brokerSignature']
            : ['agreementToConductSignature', 'warrantyAndFraudSignature'],
    };

    const isQuoteExpired = quote?.daysToExpire === -1 && !isAdmin;
    const isQuoteBindable = !isQuoteExpired;
    const formPages = isQuoteBindable ? [quotePage, signPage] : [quotePage];

    const optionsWizardForm = useWizardForm(optionsForm, {
        pages: formPages as WizardPages<OpaqueForm<ESPQuoteOptionsFormData>>,
        initialValue: initialValue,
    });

    const isFormDirty = optionsWizardForm.status === 'dirty';
    const isQuoteReferred = quote?.status === 'referred';
    useEffect(() => {
        let isCanceled = false;
        if (quote && isFormDirty && isQuoteReferred) {
            execute(DraftQuote, { quote }).then((result) => {
                if (isCanceled) {
                    return;
                }
                if (isOK(result)) {
                    setQuote(result.value.quote as ESPQuote);
                }
            });
        }
        return () => {
            isCanceled = true;
        };
    }, [quote, isFormDirty, isQuoteReferred]);

    const quoteStepPage: Page<ESPQuoteOptionsFormData, ESPQuote> = {
        name: 'coverage',
        component: ESPCoveragesPage,
    };
    const quoteSignPage: Page<ESPQuoteOptionsFormData, ESPQuote> = {
        name: 'signature',
        component: isBroker ? BrokerSignaturePage : QuoteSignature,
    };
    const pages: Page<ESPQuoteOptionsFormData, ESPQuote>[] = isQuoteBindable
        ? [quoteStepPage, quoteSignPage]
        : [quoteStepPage];

    const DownloadQuoteItem: MenuItem<ESPQuoteOptionsFormData> = {
        component: DownloadQuoteButton,
        isDisabled: isFormDirty || isQuoteReferred,
    };

    const DownloadSignaturePacket: MenuItem<ESPQuoteOptionsFormData> = {
        component: DownloadSignaturePacketButton,
        isDisabled: isFormDirty || isQuoteReferred,
    };

    const EditApplicationItem: MenuItem<ESPQuoteOptionsFormData> = {
        component: EditApplicationButton,
    };

    const DownloadESPGTCItem: MenuItem<ESPQuoteOptionsFormData> = {
        component: DownloadESPGTCButton(isPlus(quote)),
        isDisabled: isFormDirty,
    };

    const menuButtons = isBroker
        ? !isQuoteReferred
            ? [DownloadESPGTCItem, DownloadSignaturePacket, DownloadQuoteItem, EditApplicationItem]
            : [DownloadESPGTCItem, EditApplicationItem]
        : [DownloadESPGTCItem, DownloadQuoteItem];

    const navigation =
        isQuoteReferred && !isFormDirty
            ? withExtraProps(EspReferredNavigation, {
                  showConformationModal: higherLimitModal.show,
                  disabled: higherLimitsRequested,
              })
            : QuoteOnDemandNavigation;
    const referredNavigation: PageNavigationComponent<ESPQuoteOptionsFormData, ESPQuote> =
        ReferredQuoteOnDemandNavigation;

    const quoteBreakdown = useMemo(
        () =>
            withExtraProps(ESPQuoteBreakdown, {
                isPremiumVisible: quote && !isQuoteReferred,
            }),
        [quote, isQuoteReferred],
    );
    return (
        <React.Fragment>
            <HigherLimitModal
                modal={higherLimitModal}
                trigger={optionsWizardForm.trigger}
                setHigherLimitsRequested={onSetHigherLimitsRequested}
            />
            ..
            <QuoteLandingPage
                title="Startup Package"
                applicationId={applicationId}
                quote={quote}
                optionsWizardForm={optionsWizardForm}
                pages={pages}
                quoteBreakdown={quoteBreakdown}
                quoteSummary={ESPQuoteSummary}
                exitUrl={cast<URI>(isBroker ? '/broker/dashboard' : '/summary')}
                menuItems={menuButtons}
                daysToExpire={quote?.daysToExpire}
                pageNavigation={isQuoteBindable ? navigation : referredNavigation}
                handleBindCoverage={handleBindCoverageEvent}
                restriction={restriction}
            />
        </React.Fragment>
    );
}

/*
Copyright 2019 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

import "regenerator-runtime"; // needed for some of react-spectrum
import React, { useState } from "react";
import { object, array, string } from "yup";
import { FieldArray } from "formik";
import Textfield from "@react/react-spectrum/Textfield";
import RadioGroup from "@react/react-spectrum/RadioGroup";
import Radio from "@react/react-spectrum/Radio";
import Checkbox from "@react/react-spectrum/Checkbox";
import Button from "@react/react-spectrum/Button";
import Alert from "@react/react-spectrum/Alert";
import ModalTrigger from "@react/react-spectrum/ModalTrigger";
import Dialog from "@react/react-spectrum/Dialog";
import FieldLabel from "@react/react-spectrum/FieldLabel";
import Delete from "@react/react-spectrum/Icon/Delete";
import { Accordion, AccordionItem } from "@react/react-spectrum/Accordion";
import CheckboxList from "../components/checkboxList";
import "@react/react-spectrum/Form"; // needed for spectrum form styles
import render from "../render";
import WrappedField from "../components/wrappedField";
import ExtensionView from "../components/extensionView";
import EditorButton from "../components/editorButton";
import InfoTipLayout from "../components/infoTipLayout";
import copyPropertiesIfNotDefault from "./utils/copyPropertiesIfNotDefault";
import singleDataElementRegex from "../constants/singleDataElementRegex";
import "./configuration.styl";

const contextGranularityEnum = {
  ALL: "all",
  SPECIFIC: "specific"
};
const contextOptions = ["web", "device", "environment", "placeContext"];

const getInstanceDefaults = initInfo => ({
  name: "alloy",
  configId: "",
  orgId: initInfo.company.orgId,
  edgeDomain: "edge.adobedc.net",
  edgeBasePath: "ee",
  errorsEnabled: true,
  optInEnabled: false,
  prehidingStyle: "",
  contextGranularity: contextGranularityEnum.ALL,
  context: contextOptions,
  idMigrationEnabled: true,
  thirdPartyCookiesEnabled: true,
  clickCollectionEnabled: true,
  onBeforeEventSend: "",
  downloadLinkQualifier:
    "\\.(exe|zip|wav|mp3|mov|mpg|avi|wmv|pdf|doc|docx|xls|xlsx|ppt|pptx)$"
});

const createDefaultInstance = initInfo =>
  JSON.parse(JSON.stringify(getInstanceDefaults(initInfo)));

const getInitialValues = ({ initInfo }) => {
  const instanceDefaults = getInstanceDefaults(initInfo);
  let { instances } = initInfo.settings || {};

  if (instances) {
    instances.forEach(instance => {
      if (instance.context) {
        instance.contextGranularity = contextGranularityEnum.SPECIFIC;
      }

      // Copy default values to the instance if the properties
      // aren't already defined on the instance. This is primarily
      // because Formik requires all fields to have initial values.
      Object.keys(instanceDefaults).forEach(key => {
        if (instance[key] === undefined) {
          instance[key] = instanceDefaults[key];
        }
      });
    });
  } else {
    instances = [createDefaultInstance(initInfo)];
  }

  return {
    instances
  };
};

const getSettings = ({ values, initInfo }) => {
  const instanceDefaults = getInstanceDefaults(initInfo);
  return {
    instances: values.instances.map(instance => {
      const trimmedInstance = {
        name: instance.name
      };

      const copyPropertyKeys = [
        "configId",
        "orgId",
        "edgeDomain",
        "edgeBasePath",
        "errorsEnabled",
        "optInEnabled",
        "prehidingStyle",
        "idMigrationEnabled",
        "thirdPartyCookiesEnabled",
        "onBeforeEventSend",
        "clickCollectionEnabled"
      ];

      if (instance.clickCollectionEnabled) {
        copyPropertyKeys.push("downloadLinkQualifier");
      }

      copyPropertiesIfNotDefault(
        trimmedInstance,
        instance,
        instanceDefaults,
        copyPropertyKeys
      );

      if (instance.contextGranularity === contextGranularityEnum.SPECIFIC) {
        trimmedInstance.context = instance.context;
      }

      return trimmedInstance;
    })
  };
};

const validateDuplicateValue = (createError, instances, key, message) => {
  const values = instances.map(instance => instance[key]);
  const duplicateIndex = values.findIndex(
    (value, index) => values.indexOf(value) < index
  );

  return (
    duplicateIndex === -1 ||
    createError({
      path: `instances[${duplicateIndex}].${key}`,
      message
    })
  );
};

const onBeforeEventSendValidationMessage = "Please specify a data element.";

const validationSchema = object()
  .shape({
    instances: array().of(
      object().shape({
        name: string()
          .required("Please specify a name.")
          // Under strict mode, setting window["123"], where the key is all
          // digits, throws a "Failed to set an indexed property on 'Window'" error.
          // This regex ensure there's at least one non-digit.
          .matches(/\D+/, "Please provide a non-numeric name.")
          .test({
            name: "notWindowPropertyName",
            message:
              "Please provide a name that does not conflict with a property already found on the window object.",
            test(value) {
              return !(value in window);
            }
          }),
        configId: string().required("Please specify a config ID."),
        orgId: string().required("Please specify an IMS organization ID."),
        edgeDomain: string().required("Please specify an edge domain."),
        edgeBasePath: string().required("Please specify an edge base path."),
        downloadLinkQualifier: string().when("clickCollectionEnabled", {
          is: true,
          then: string()
            .min(1)
            .test({
              name: "invalidDownloadLinkQualifier",
              message: "Please provide a valid regular expression.",
              test(value) {
                try {
                  return new RegExp(value) !== null;
                } catch (e) {
                  return false;
                }
              }
            })
        }),
        onBeforeEventSend: string().matches(singleDataElementRegex, {
          message: onBeforeEventSendValidationMessage,
          excludeEmptyString: true
        })
      })
    )
  })
  // TestCafe doesn't allow this to be an arrow function because of
  // how it scopes "this".
  // eslint-disable-next-line func-names
  .test("uniqueName", function(settings) {
    return validateDuplicateValue(
      this.createError.bind(this),
      settings.instances,
      "name",
      "Please provide a name unique from those used for other instances."
    );
  })
  // TestCafe doesn't allow this to be an arrow function because of
  // how it scopes "this".
  // eslint-disable-next-line func-names
  .test("uniqueConfigId", function(settings) {
    return validateDuplicateValue(
      this.createError.bind(this),
      settings.instances,
      "configId",
      "Please provide a config ID unique from those used for other instances."
    );
  })
  // TestCafe doesn't allow this to be an arrow function because of
  // how it scopes "this".
  // eslint-disable-next-line func-names
  .test("uniqueOrgId", function(settings) {
    return validateDuplicateValue(
      this.createError.bind(this),
      settings.instances,
      "orgId",
      "Please provide an IMS Organization ID unique from those used for other instances."
    );
  });

const Configuration = () => {
  const [selectedAccordionIndex, setSelectedAccordionIndex] = useState();
  const [isFirstExtensionViewRender, setIsFirstExtensionViewRender] = useState(
    true
  );

  return (
    <ExtensionView
      getInitialValues={getInitialValues}
      getSettings={getSettings}
      validationSchema={validationSchema}
      render={({ formikProps, initInfo }) => {
        const {
          values,
          errors,
          isSubmitting,
          isValidating,
          setFieldValue,
          initialValues
        } = formikProps;

        // Only expand the first accordion item if there's one instance because
        // users may get disoriented if we automatically expand the first item
        // when there are multiple instances.
        if (isFirstExtensionViewRender && values.instances.length === 1) {
          setSelectedAccordionIndex(0);
        }

        // If the user just tried to save the configuration and there's
        // a validation error, make sure the first accordion item containing
        // an error is shown.
        if (isSubmitting && !isValidating && errors && errors.instances) {
          const instanceIndexContainingErrors = errors.instances.findIndex(
            instance => instance
          );
          setSelectedAccordionIndex(instanceIndexContainingErrors);
        }

        setIsFirstExtensionViewRender(false);

        return (
          <div>
            <FieldArray
              name="instances"
              render={arrayHelpers => {
                return (
                  <div>
                    <div className="u-alignRight">
                      <Button
                        label="Add Instance"
                        onClick={() => {
                          arrayHelpers.push(createDefaultInstance(initInfo));
                          setSelectedAccordionIndex(values.instances.length);
                        }}
                      />
                    </div>
                    <Accordion
                      selectedIndex={selectedAccordionIndex}
                      className="u-gapTop2x"
                      onChange={setSelectedAccordionIndex}
                    >
                      {values.instances.map((instance, index) => (
                        <AccordionItem
                          key={index}
                          header={instance.name || "unnamed instance"}
                        >
                          <div>
                            <InfoTipLayout tip="A global method on the window object will be created with this name.">
                              <FieldLabel labelFor="nameField" label="Name" />
                            </InfoTipLayout>
                            <div>
                              <WrappedField
                                id="nameField"
                                name={`instances.${index}.name`}
                                component={Textfield}
                                componentClassName="u-fieldLong"
                                supportDataElement="replace"
                              />
                            </div>
                            {// If we're editing an existing configuration and the name changes.
                            initInfo.settings &&
                            initialValues.instances[0].name !==
                              values.instances[0].name ? (
                              <Alert
                                id="nameChangeAlert"
                                className="ConstrainedAlert"
                                header="Potential Problems Due to Name Change"
                                variant="warning"
                              >
                                Any rule components or data elements using this
                                instance will no longer function as expected
                                when running on your website. We recommend
                                removing or updating those resources before
                                publishing your next library.
                              </Alert>
                            ) : null}
                            <div />
                          </div>
                          <div className="u-gapTop">
                            <InfoTipLayout tip="Your assigned config ID, which links the SDK to the appropriate accounts and configuration.">
                              <FieldLabel
                                labelFor="configIdField"
                                label="Config ID"
                              />
                            </InfoTipLayout>
                            <div>
                              <WrappedField
                                id="configIdField"
                                name={`instances.${index}.configId`}
                                component={Textfield}
                                componentClassName="u-fieldLong"
                                supportDataElement="replace"
                              />
                            </div>
                          </div>
                          <div className="u-gapTop">
                            <InfoTipLayout tip="Your assigned Experience Cloud organization ID.">
                              <FieldLabel
                                labelFor="orgIdField"
                                label="IMS Organization ID"
                              />
                            </InfoTipLayout>
                            <div>
                              <WrappedField
                                id="orgIdField"
                                name={`instances.${index}.orgId`}
                                component={Textfield}
                                componentClassName="u-fieldLong"
                                supportDataElement="replace"
                              />
                              <Button
                                id="orgIdRestoreButton"
                                label="Restore to default"
                                onClick={() => {
                                  const instanceDefaults = getInstanceDefaults(
                                    initInfo
                                  );
                                  setFieldValue(
                                    `instances.${index}.orgId`,
                                    instanceDefaults.orgId
                                  );
                                }}
                                quiet
                                variant="quiet"
                              />
                            </div>
                          </div>
                          <div className="u-gapTop">
                            <InfoTipLayout
                              tip="The domain that will be used to interact with
                              Adobe Services. Update this setting if you have
                              mapped one of your first party domains (using
                              CNAME) to an Adobe provisioned domain."
                            >
                              <FieldLabel
                                labelFor="edgeDomainField"
                                label="Edge Domain"
                              />
                            </InfoTipLayout>
                            <div>
                              <WrappedField
                                id="edgeDomainField"
                                name={`instances.${index}.edgeDomain`}
                                component={Textfield}
                                componentClassName="u-fieldLong"
                                supportDataElement="replace"
                              />
                              <Button
                                id="edgeDomainRestoreButton"
                                label="Restore to default"
                                onClick={() => {
                                  const instanceDefaults = getInstanceDefaults(
                                    initInfo
                                  );
                                  setFieldValue(
                                    `instances.${index}.edgeDomain`,
                                    instanceDefaults.edgeDomain
                                  );
                                }}
                                quiet
                                variant="quiet"
                              />
                            </div>
                          </div>
                          <div className="u-gapTop">
                            <InfoTipLayout tip="Allows uncaught errors to be displayed in the console.">
                              <WrappedField
                                name={`instances.${index}.errorsEnabled`}
                                component={Checkbox}
                                label="Enable errors"
                              />
                            </InfoTipLayout>
                          </div>

                          <h3>Privacy</h3>

                          <div className="u-gapTop">
                            <InfoTipLayout tip="Queues privacy-sensitive work until the user opts in.">
                              <WrappedField
                                name={`instances.${index}.optInEnabled`}
                                component={Checkbox}
                                label="Enable Opt-In"
                              />
                            </InfoTipLayout>
                          </div>

                          <h3>Identity</h3>

                          <div className="u-gapTop">
                            <InfoTipLayout tip="Enables the AEP Web SDK to preserve the ECID by reading/writing the AMCV cookie. Use this config until users are fully migrated to the Alloy cookie and in situations where you have mixed pages on your website.">
                              <WrappedField
                                name={`instances.${index}.idMigrationEnabled`}
                                component={Checkbox}
                                label="Migrate ECID from VisitorAPI to Alloy to prevent visitor cliffing"
                              />
                            </InfoTipLayout>
                          </div>

                          <div className="u-gapTop">
                            <InfoTipLayout tip="Enables the setting of Adobe third-party cookies. The SDK has the ability to persist the visitor ID in a third-party context to enable the same visitor ID to be used across site. This is useful if you have multiple sites or you want to share data with partners; however, sometimes this is not desired for privacy reasons.">
                              <WrappedField
                                name={`instances.${index}.thirdPartyCookiesEnabled`}
                                component={Checkbox}
                                label="Use third-party cookies"
                              />
                            </InfoTipLayout>
                          </div>

                          <h3>Personalization</h3>

                          <div className="u-gapTop">
                            <InfoTipLayout tip="A CSS style definition that will hide content areas of your web page while personalized content is loaded from the server.">
                              <FieldLabel
                                labelFor="prehidingStyleField"
                                label="Prehiding Style (optional)"
                              />
                            </InfoTipLayout>
                            <div>
                              <WrappedField
                                id="prehidingStyleField"
                                name={`instances.${index}.prehidingStyle`}
                                component={EditorButton}
                                language="css"
                              />
                            </div>
                          </div>

                          <h3>Data Collection</h3>
                          <div className="u-gapTop">
                            <InfoTipLayout tip="If you want to add, remove, or modify fields from the event globally, you can configure an `onBeforeEventSend` callback. This callback will be called everytime an event is sent. This callback passes an object with a `xdm` field. Modify the `xdm` object to change the data that is sent in the event.">
                              <FieldLabel
                                labelFor="onBeforeEventSendField"
                                label="Callback function for modifying data before each event is sent to the server"
                              />
                            </InfoTipLayout>
                            <div>
                              <WrappedField
                                id="onBeforeEventSendField"
                                name={`instances.${index}.onBeforeEventSend`}
                                component={Textfield}
                                componentClassName="u-fieldLong"
                                supportDataElement="replace"
                              />
                            </div>
                          </div>
                          <div className="u-gapTop">
                            <InfoTipLayout tip="Indicates whether data associated with clicks on navigational links, download links, or personalized content should be automatically collected.">
                              <WrappedField
                                name={`instances.${index}.clickCollectionEnabled`}
                                component={Checkbox}
                                label="Enable click data collection"
                              />
                            </InfoTipLayout>
                          </div>
                          {values.instances[index].clickCollectionEnabled ? (
                            <div className="FieldSubset u-gapTop">
                              <InfoTipLayout tip="Regular expression that qualifies a link URL as a download link.">
                                <FieldLabel
                                  labelFor="downloadLinkQualifier"
                                  label="Download Link Qualifier"
                                />
                              </InfoTipLayout>
                              <div>
                                <WrappedField
                                  id="downloadLinkQualifierField"
                                  name={`instances.${index}.downloadLinkQualifier`}
                                  component={Textfield}
                                  componentClassName="u-fieldLong"
                                />
                                <Button
                                  id="downloadLinkQualifierTestButton"
                                  className="u-gapLeft"
                                  label="Test"
                                  onClick={() => {
                                    const currentPattern =
                                      values.instances[index]
                                        .downloadLinkQualifier;
                                    window.extensionBridge
                                      .openRegexTester({
                                        pattern: currentPattern
                                      })
                                      .then(newPattern => {
                                        values.instances[
                                          index
                                        ].downloadLinkQualifier = newPattern;
                                        setFieldValue(
                                          `instances.${index}.downloadLinkQualifier`,
                                          newPattern
                                        );
                                      });
                                  }}
                                  quiet
                                  variant="quiet"
                                />
                                <Button
                                  id="downloadLinkQualifierRestoreButton"
                                  label="Restore to default"
                                  onClick={() => {
                                    const instanceDefaults = getInstanceDefaults(
                                      initInfo
                                    );
                                    setFieldValue(
                                      `instances.${index}.downloadLinkQualifier`,
                                      instanceDefaults.downloadLinkQualifier
                                    );
                                  }}
                                  quiet
                                  variant="quiet"
                                />
                              </div>
                            </div>
                          ) : null}
                          <div className="u-gapTop">
                            <InfoTipLayout tip="Indicates which categories of context information should be automatically collected.">
                              <FieldLabel
                                labelFor="contextGranularityField"
                                label="When sending event data, automatically include:"
                              />
                            </InfoTipLayout>
                            <WrappedField
                              id="contextGranularityField"
                              name={`instances.${index}.contextGranularity`}
                              component={RadioGroup}
                              componentClassName="u-flexColumn"
                            >
                              <Radio
                                value={contextGranularityEnum.ALL}
                                label="all context information"
                              />
                              <Radio
                                value={contextGranularityEnum.SPECIFIC}
                                label="specific context information"
                              />
                            </WrappedField>
                          </div>
                          {values.instances[index].contextGranularity ===
                          contextGranularityEnum.SPECIFIC ? (
                            <div className="FieldSubset u-gapTop">
                              <WrappedField
                                name={`instances.${index}.context`}
                                component={CheckboxList}
                                options={contextOptions}
                              />
                            </div>
                          ) : null}

                          <h3>Advanced Settings</h3>

                          <div className="u-gapTop">
                            <InfoTipLayout
                              tip="Specifies the base path of the endpoint used
                              to interact with Adobe Services. This setting
                              should only be changed if you are not intending
                              to use the default production environment."
                            >
                              <FieldLabel
                                labelFor="edgeBasePathField"
                                label="Edge Base Path"
                              />
                            </InfoTipLayout>
                            <div>
                              <WrappedField
                                id="edgeBasePathField"
                                name={`instances.${index}.edgeBasePath`}
                                component={Textfield}
                                componentClassName="u-fieldLong"
                                supportDataElement="replace"
                              />
                              <Button
                                id="edgeBasePathRestoreButton"
                                label="Restore to default"
                                onClick={() => {
                                  const instanceDefaults = getInstanceDefaults(
                                    initInfo
                                  );
                                  setFieldValue(
                                    `instances.${index}.edgeBasePath`,
                                    instanceDefaults.edgeBasePath
                                  );
                                }}
                                quiet
                                variant="quiet"
                              />
                            </div>
                          </div>

                          <div className="u-gapTop2x">
                            <ModalTrigger>
                              <Button
                                id="deleteButton"
                                label="Delete Instance"
                                icon={<Delete />}
                                variant="action"
                                disabled={values.instances.length === 1}
                              />
                              {values.instances.length === 1 ? (
                                <span className="Note u-gapLeft">
                                  You must have at least one instance to use
                                  this extension.
                                </span>
                              ) : null}
                              <Dialog
                                onConfirm={() => {
                                  arrayHelpers.remove(index);
                                  setSelectedAccordionIndex(0);
                                }}
                                title="Resource Usage"
                                confirmLabel="Delete"
                                cancelLabel="Cancel"
                              >
                                Any rule components or data elements using this
                                instance will no longer function as expected
                                when running on your website. We recommend
                                removing these resources or switching them to
                                use a different instance before publishing your
                                next library. Would you like to proceed?
                              </Dialog>
                            </ModalTrigger>
                          </div>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                );
              }}
            />
          </div>
        );
      }}
    />
  );
};

render(Configuration);

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

import createInstanceManager from "../../../src/lib/createInstanceManager";
import turbineVariable from "../helpers/turbineVariable";

describe("Instance Manager", () => {
  let runAlloy;
  let instanceManager;
  let mockWindow;

  beforeEach(() => {
    turbineVariable.mock({
      getExtensionSettings() {
        return {
          accounts: [
            {
              propertyID: "PR123",
              instanceName: "alloy1"
            },
            {
              propertyID: "PR456",
              instanceName: "alloy2"
            }
          ]
        };
      }
    });
    mockWindow = {};
    runAlloy = jasmine.createSpy().and.callFake(instanceNames => {
      instanceNames.forEach(instanceName => {
        mockWindow[instanceName] = jasmine.createSpy();
      });
    });
    instanceManager = createInstanceManager(mockWindow, runAlloy);
  });

  afterEach(() => {
    turbineVariable.reset();
  });

  it("runs alloy", () => {
    expect(runAlloy).toHaveBeenCalledWith(["alloy1", "alloy2"]);
  });

  it("creates an SDK instance for each account", () => {
    expect(mockWindow.alloy1).toEqual(jasmine.any(Function));
    expect(mockWindow.alloy2).toEqual(jasmine.any(Function));
  });

  it("configures an SDK instance for each account", () => {
    expect(mockWindow.alloy1).toHaveBeenCalledWith("configure", {
      propertyID: "PR123"
    });
    expect(mockWindow.alloy2).toHaveBeenCalledWith("configure", {
      propertyID: "PR456"
    });
  });

  it("returns instance by property ID", () => {
    expect(instanceManager.getInstance("PR456")).toBe(mockWindow.alloy2);
  });
});

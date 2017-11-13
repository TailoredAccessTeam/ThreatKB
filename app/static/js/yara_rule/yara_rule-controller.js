'use strict';

angular.module('ThreatKB')
    .controller('Yara_ruleController', ['$scope', '$filter', '$http', '$uibModal', 'resolvedYara_rule', 'Yara_rule', 'Cfg_states', 'CfgCategoryRangeMapping', 'Users', 'growl', 'openModalForId', 'uiGridConstants',
        function ($scope, $filter, $http, $uibModal, resolvedYara_rule, Yara_rule, Cfg_states, CfgCategoryRangeMapping, Users, growl, openModalForId, uiGridConstants) {

            $scope.yara_rules = resolvedYara_rule;

            $scope.users = Users.query();

            $scope.filterOptions = {
                filterText: ''
            };

            var paginationOptions = {
                pageNumber: 1,
                pageSize: 25,
                searches: {},
                sort_by: null,
                sort_dir: null
            };

            $scope.gridOptions = {
                paginationPageSizes: [25, 50, 75, 100],
                paginationPageSize: 25,
                useExternalFiltering: true,
                useExternalPagination: true,
                useExternalSorting: true,
                enableFiltering: true,
                flatEntityAccess: true,
                fastWatch: true,
                onRegisterApi: function (gridApi) {
                    $scope.gridApi = gridApi;
                    $scope.gridApi.core.on.filterChanged($scope, function () {
                        var grid = this.grid;
                        paginationOptions.searches = {};

                        for (var i = 0; i < grid.columns.length; i++) {
                            var column = grid.columns[i];
                            if (column.filters[0].term !== undefined && column.filters[0].term !== null) {
                                paginationOptions.searches[column.colDef.field] = column.filters[0].term
                            }
                        }
                        getPage()
                    });
                    $scope.gridApi.core.on.sortChanged($scope, function (grid, sortColumns) {
                        if (sortColumns.length === 0) {
                            paginationOptions.sort_dir = null;
                        } else {
                            paginationOptions.sort_by = sortColumns[0].colDef.field;
                            paginationOptions.sort_dir = sortColumns[0].sort.direction;
                        }
                        getPage();
                    });
                    gridApi.pagination.on.paginationChanged($scope, function (newPage, pageSize) {
                        paginationOptions.pageNumber = newPage;
                        paginationOptions.pageSize = pageSize;
                        getPage();
                    });
                },
                rowHeight: 35,
                columnDefs:
                    [
                        {field: 'eventid', displayName: "Event ID", width: "10%"},
                        {field: 'name', width: "30%", enableSorting: false},
                        {field: 'category', enableSorting: false},
                        {field: 'state', enableSorting: false},
                        {
                            field: 'owner_user.email',
                            displayName: 'Owner',
                            width: '20%',
                            enableSorting: false,
                            enableFiltering: false,
                            cellTemplate: '<ui-select append-to-body="true" ng-model="row.entity.owner_user"'
                            + ' on-select="grid.appScope.save(row.entity)">'
                            + '<ui-select-match placeholder="Select an owner ...">'
                            + '<small><span ng-bind="$select.selected.email || row.entity.owner_user.email"></span></small>'
                            + '</ui-select-match>'
                            + '<ui-select-choices'
                            + ' repeat="person in (grid.appScope.users | filter: $select.search) track by person.id">'
                            + '<small><span ng-bind="person.email"></span></small>'
                            + '</ui-select-choices>'
                            + '</ui-select>'
                            + '</div>'
                        },
                        {
                            name: 'Actions',
                            enableFiltering: false,
                            enableColumnMenu: false,
                            enableSorting: false,
                            cellTemplate: '<div style="text-align: center;">'
                            + '<button type="button" ng-click="grid.appScope.update(row.entity.id)"'
                            + ' class="btn btn-sm">'
                            + '<small><span class="glyphicon glyphicon-pencil"></span>'
                            + '</small>'
                            + '</button>'
                            + '&nbsp;'
                            + '<button ng-click="grid.appScope.delete(row.entity.id)"'
                            + ' ng-confirm-click="Are you sure you want to '
                            + 'inactivate this signature ({{ row.entity.name }})?" class="btn btn-sm btn-danger">'
                            + '<small>'
                            + '<span class="glyphicon glyphicon-remove-circle"></span>'
                            + '</small>'
                            + '</button></div>'
                        }
                    ]
            };

            $scope.state = {};

            var getPage = function () {
                var url = '/ThreatKB/yara_rules?';
                url += 'page_number=' + (paginationOptions.pageNumber - 1);
                url += '&page_size=' + paginationOptions.pageSize;
                switch (paginationOptions.sort_dir) {
                    case uiGridConstants.ASC:
                        url += '&sort_dir=ASC';
                        break;
                    case uiGridConstants.DESC:
                        url += '&sort_dir=DESC';
                        break;
                    default:
                        break;
                }
                if (paginationOptions.sort_by !== null) {
                    url += '&sort_by=' + paginationOptions.sort_by;
                }
                if (paginationOptions.searches !== {}) {
                    url += '&searches=' + JSON.stringify(paginationOptions.searches);
                }
                $http.get(url)
                    .then(function (response) {
                        $scope.gridOptions.totalItems = response.data.total_count;
                        $scope.gridOptions.data = response.data.data;
                    }, function (error) {
                    });
            };

            $scope.getTableHeight = function () {
                var rowHeight = $scope.gridOptions.rowHeight;
                var headerHeight = 100;
                return {
                    height: ($scope.gridOptions.data.length * rowHeight + headerHeight) + "px"
                };
            };

            $scope.create = function () {
                $scope.clear();
                $scope.open();
            };

            $scope.update = function (id) {
                $scope.yara_rule = Yara_rule.resource.get({id: id});
                $scope.cfg_states = Cfg_states.query();
                $scope.users = Users.query();
                $scope.cfg_category_range_mapping = CfgCategoryRangeMapping.query();
                $scope.open(id);
            };

            $scope.delete = function (id) {
                Yara_rule.resource.delete({id: id}, function () {
                    $scope.yara_rules = Yara_rule.resource.query();
                    getPage();
                });
            };

            $scope.save = function (id_or_rule) {
                var id = id_or_rule;
                if (typeof(id_or_rule) === "object") {
                    if (id_or_rule.merge) {
                        Yara_rule.merge_signature($scope.yara_rule.id, id_or_rule.id).then(function (data) {
                            growl.info("Successfully merged '" + $scope.yara_rule.name + "' into '" + id_or_rule.name + "'", {ttl: 3000});
                        }, function (error) {
                            growl.error(error, {ttl: -1})
                        })
                    } else {
                        id = id_or_rule.id;
                        $scope.yara_rule = id_or_rule;
                    }
                }

                if (typeof(id) === "number") {
                    Yara_rule.resource.update({id: id}, $scope.yara_rule, function () {
                        $scope.yara_rules = Yara_rule.resource.query();
                        getPage();
                    });
                } else {
                    Yara_rule.resource.save($scope.yara_rule, function () {
                        $scope.yara_rules = Yara_rule.resource.query();
                        getPage();
                    });
                }
            };

            $scope.clear = function () {
                $scope.yara_rule = {
                    "creation_date": "",
                    "last_revision_date": "",
                    "state": "",
                    "name": "",
                    "test_status": "",
                    "confidence": "",
                    "severity": "",
                    "description": "",
                    "category": "",
                    "file_type": "",
                    "subcategory1": "",
                    "subcategory2": "",
                    "subcategory3": "",
                    "reference_link": "",
                    "condition": "",
                    "strings": "",
                    "eventid": "",
                    "id": "",
                    "tags": [],
                    "addedTags": [],
                    "removedTags": [],
                    "comments": [],
                    "files": []
                };
            };

            $scope.open = function (id) {
                var yara_ruleSave = $uibModal.open({
                    templateUrl: 'yara_rule-save.html',
                    controller: 'Yara_ruleSaveController',
                    size: 'lg',
                    resolve: {
                        yara_rule: function () {
                            return $scope.yara_rule;
                        },
                        yara_rules: function () {
                            return $scope.yara_rules;
                        }
                    }
                });

                yara_ruleSave.result.then(function (entity) {
                    if (entity.merge) {
                        $scope.save(entity);
                    } else {
                        $scope.yara_rule = entity;
                        $scope.save(id);
                    }
                });
            };

            getPage();
            if (openModalForId !== null) {
                $scope.update(openModalForId);
            }
        }])
    .controller('Yara_ruleSaveController', ['$scope', '$http', '$uibModalInstance', '$location', 'yara_rule', 'yara_rules', 'Cfg_states', 'Comments', 'Upload', 'Files', 'CfgCategoryRangeMapping', 'growl', 'Users', 'Tags', 'Yara_rule', 'Cfg_settings', 'Bookmarks',
        function ($scope, $http, $uibModalInstance, $location, yara_rule, yara_rules, Cfg_states, Comments, Upload, Files, CfgCategoryRangeMapping, growl, Users, Tags, Yara_rule, Cfg_settings, Bookmarks) {

            $scope.yara_rule = yara_rule;
            $scope.yara_rules = yara_rules;
            $scope.yara_rule.new_comment = "";
            $scope.Comments = Comments;
            $scope.Files = Files;
            $scope.selected_signature = null;


            $scope.file_store_path = Cfg_settings.get({key: "FILE_STORE_PATH"});
            $scope.entity_mapping = Comments.ENTITY_MAPPING;

            if ($scope.yara_rule.$promise !== undefined) {
                $scope.yara_rule.$promise.then(function (result) {
                }, function (errorMsg) {
                    growl.error("Yara Rule Not Found", {ttl: -1});
                    $uibModalInstance.dismiss('cancel');
                });
            }

            $scope.bookmark = function (id) {
                Bookmarks.createBookmark(Bookmarks.ENTITY_MAPPING.SIGNATURE, id).then(function (data) {
                    $scope.yara_rule.bookmarked = true;
                });
            };

            $scope.unbookmark = function (id) {
                Bookmarks.deleteBookmark(Bookmarks.ENTITY_MAPPING.SIGNATURE, id).then(function (data) {
                    $scope.yara_rule.bookmarked = false;
                });
            };

            $scope.getPermalink = function (id) {
                return $location.absUrl() + "/" + id;
            };

            $scope.cfg_states = Cfg_states.query();
            $scope.cfg_category_range_mapping = CfgCategoryRangeMapping.query();
            $scope.do_not_bump_revision = false;

            $scope.just_opened = true;
            $scope.negTestDir = Cfg_settings.get({key: "NEGATIVE_TESTING_FILE_DIRECTORY"});
            $scope.testingPos = false;
            $scope.testingNeg = false;

            $scope.print_comment = function (comment) {
                return comment.comment.replace(/(?:\r\n|\r|\n)/g, "<BR>");
            };

            $scope.editor_options = {
                lineNumbers: true,
                lineWrapping: false,
                mode: 'yara'
            };

            $scope.update_selected_signature = function (yara_rule) {
                $scope.selected_signature = yara_rule;
            };

            $scope.add_comment = function (id) {
                if (!$scope.yara_rule.new_comment) {
                    return;
                }

                $scope.Comments.resource.save({
                    comment: $scope.yara_rule.new_comment,
                    entity_type: Comments.ENTITY_MAPPING.SIGNATURE,
                    entity_id: id
                }, function () {
                    $scope.yara_rule.new_comment = "";
                    $scope.yara_rule.comments = $scope.Comments.resource.query({
                        entity_type: Comments.ENTITY_MAPPING.SIGNATURE,
                        entity_id: id
                    })
                });
            };

            $scope.$watch('files', function () {
                $scope.upload($scope.files);
            });

            $scope.upload = function (id, files) {
                if (files && files.length) {
                    for (var i = 0; i < files.length; i++) {
                        var file = files[i];
                        if (!file.$error) {
                            Upload.upload({
                                url: '/ThreatKB/file_upload',
                                method: 'POST',
                                data: {
                                    file: file,
                                    entity_type: Files.ENTITY_MAPPING.SIGNATURE,
                                    entity_id: id
                                }
                            }).then(function (resp) {
                                console.log('Success ' + resp.config.data.file.name + 'uploaded.');
                                $scope.yara_rule.files = $scope.Files.resource.query({
                                    entity_type: Files.ENTITY_MAPPING.SIGNATURE,
                                    entity_id: id
                                });
                                growl.info('Success ' + JSON.stringify(resp.data, null, 2), {ttl: 3000});
                            }, function (resp) {
                                console.log('Error status: ' + resp.status);
                                growl.error(resp);
                            }, function (evt) {
                                var progressPercentage = parseInt(100.0 * evt.loaded / evt.total);
                                console.log('progress: ' + progressPercentage + '% ' + evt.config.data.file.name);
                            });
                        }
                    }
                }
            };

            $scope.ok = function () {
                $uibModalInstance.close($scope.yara_rule);
            };

            $scope.cancel = function () {
                $uibModalInstance.dismiss('cancel');
            };

            $scope.addedTag = function ($tag) {
                $scope.yara_rule.addedTags.push($tag)
            };

            $scope.removedTag = function ($tag) {
                $scope.yara_rule.removedTags.push($tag)
            };

            $scope.loadTags = function (query) {
                return Tags.loadTags(query);
            };

            $scope.$watch('testingPos', function () {
                $scope.testButtonTextPos = $scope.testingPos ? 'Testing...' : 'Test Signature Now';
            });

            $scope.$watch('testingNeg', function () {
                $scope.testButtonTextNeg = $scope.testingNeg ? 'Clean Testing...' : 'Clean Test Signature Now';
            });

            $scope.testSignature = function (id) {
                if (!$scope.testingPos) {
                    $scope.testingPos = true;
                    return $http.get('/ThreatKB/test_yara_rule/' + id, {cache: false}).then(function (response) {
                        var testResponse = response.data;
                        var growlMsg = "Test Summary<br />"
                            + "---------------------<br/>"
                            + "Total Time: " + testResponse['duration'] + " ms<br/>"
                            + "Total Files: " + testResponse['files_tested'] + "<br/>"
                            + "Matches Found: " + testResponse['files_matched'] + "<br/>"
                            + "Tests Killed: " + testResponse['tests_terminated'] + "<br/>"
                            + "Errors Encountered: " + testResponse['errors_encountered'];
                        if (testResponse['errors_encountered'] > 0) {
                            growlMsg += "<br/><br/>"
                                + "Errors:<br/>"
                                + "---------------------<br/>";
                            for (var i = 0; i < testResponse['error_msgs'].length; i++) {
                                growlMsg += testResponse['error_msgs'][i] + "<br/>";
                            }
                        }
                        growl.info(growlMsg, {ttl: 5000});
                        $scope.testingPos = false;
                        return true;
                    }, function (error) {
                        growl.error(error.data, {ttl: 3000});
                        $scope.testingPos = false;
                    });
                }
            };

            $scope.negTestSignature = function (id) {
                if (!$scope.testingNeg) {
                    $scope.testingNeg = true;
                    return $http.get('/ThreatKB/test_yara_rule/' + id + '?negative=1', {cache: false})
                        .then(function (response) {
                            var testResponse = response.data;
                            var growlMsg = "Clean Test Summary<br />"
                                + "---------------------<br/>"
                                + "Total Time: " + testResponse['duration'] + " ms<br/>"
                                + "Total Files: " + testResponse['files_tested'] + "<br/>"
                                + "Matches Found: " + testResponse['files_matched'] + "<br/>"
                                + "Tests Killed: " + testResponse['tests_terminated'] + "<br/>"
                                + "Errors Encountered: " + testResponse['errors_encountered'];
                            if (testResponse['errors_encountered'] > 0) {
                                growlMsg += "<br/><br/>"
                                    + "Errors:<br/>"
                                    + "---------------------<br/>";
                                for (var i = 0; i < testResponse['error_msgs'].length; i++) {
                                    growlMsg += testResponse['error_msgs'][i] + "<br/>";
                                }
                            }
                            growl.info(growlMsg, {ttl: 5000});
                            $scope.testingNeg = false;
                            return true;
                        }, function (error) {
                            growl.error(error.data, {ttl: 3000});
                            $scope.testingNeg = false;
                        });
                }
            };

            $scope.merge_signature = function () {
                if (!$scope.selected_signature) {
                    return;
                }

                $scope.selected_signature.merge = true;
                $uibModalInstance.close($scope.selected_signature);
            };

        }]);

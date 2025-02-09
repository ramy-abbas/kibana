/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { EuiFlexGroup, EuiFlexItem } from '@elastic/eui';

import { EnableRiskScore } from '../enable_risk_score';
import { getRiskScoreColumns } from './columns';
import { LastUpdatedAt } from '../../../common/components/last_updated_at';
import { HeaderSection } from '../../../common/components/header_section';
import type { RiskSeverity } from '../../../../common/search_strategy';
import { RiskScoreEntity } from '../../../../common/search_strategy';
import { generateSeverityFilter } from '../../../explore/hosts/store/helpers';
import { useQueryInspector } from '../../../common/components/page/manage_query';
import { useGlobalTime } from '../../../common/containers/use_global_time';
import { InspectButtonContainer } from '../../../common/components/inspect';
import { useQueryToggle } from '../../../common/containers/query_toggle';
import { StyledBasicTable } from '../styled_basic_table';
import { RiskScoreHeaderTitle } from '../risk_score_onboarding/risk_score_header_title';
import { RiskScoresNoDataDetected } from '../risk_score_onboarding/risk_score_no_data_detected';
import { useRefetchQueries } from '../../../common/hooks/use_refetch_queries';
import { Loader } from '../../../common/components/loader';
import { Panel } from '../../../common/components/panel';
import { useEntityInfo } from './use_entity';
import { RiskScoreHeaderContent } from './header_content';
import { ChartContent } from './chart_content';
import { useNavigateToAlertsPageWithFilters } from '../../../common/hooks/use_navigate_to_alerts_page_with_filters';
import { getRiskEntityTranslation } from './translations';
import { useKibana } from '../../../common/lib/kibana';
import { useGlobalFilterQuery } from '../../../common/hooks/use_global_filter_query';
import { useRiskScoreKpi } from '../../api/hooks/use_risk_score_kpi';
import { useRiskScore } from '../../api/hooks/use_risk_score';

const EntityAnalyticsRiskScoresComponent = ({ riskEntity }: { riskEntity: RiskScoreEntity }) => {
  const { deleteQuery, setQuery, from, to } = useGlobalTime();
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  const entity = useEntityInfo(riskEntity);
  const openAlertsPageWithFilters = useNavigateToAlertsPageWithFilters();
  const { telemetry } = useKibana().services;

  const openEntityOnAlertsPage = useCallback(
    (entityName: string) => {
      telemetry.reportEntityAlertsClicked({ entity: riskEntity });
      openAlertsPageWithFilters([
        {
          title: getRiskEntityTranslation(riskEntity),
          selectedOptions: [entityName],
          fieldName: riskEntity === RiskScoreEntity.host ? 'host.name' : 'user.name',
        },
      ]);
    },
    [telemetry, riskEntity, openAlertsPageWithFilters]
  );

  const { toggleStatus, setToggleStatus } = useQueryToggle(entity.tableQueryId);
  const columns = useMemo(
    () => getRiskScoreColumns(riskEntity, openEntityOnAlertsPage),
    [riskEntity, openEntityOnAlertsPage]
  );
  const [selectedSeverity, setSelectedSeverity] = useState<RiskSeverity[]>([]);

  const onSelectSeverityFilterGroup = useCallback((newSelection: RiskSeverity[]) => {
    setSelectedSeverity(newSelection);
  }, []);

  const severityFilter = useMemo(() => {
    const [filter] = generateSeverityFilter(selectedSeverity, riskEntity);
    return filter ? filter : undefined;
  }, [riskEntity, selectedSeverity]);

  const { filterQuery } = useGlobalFilterQuery({
    extraFilter: severityFilter,
  });

  const timerange = useMemo(
    () => ({
      from,
      to,
    }),
    [from, to]
  );

  const {
    severityCount,
    loading: isKpiLoading,
    refetch: refetchKpi,
    inspect: inspectKpi,
  } = useRiskScoreKpi({
    filterQuery,
    skip: !toggleStatus,
    timerange,
    riskEntity,
  });

  useQueryInspector({
    queryId: entity.kpiQueryId,
    loading: isKpiLoading,
    refetch: refetchKpi,
    setQuery,
    deleteQuery,
    inspect: inspectKpi,
  });
  const {
    data,
    loading: isTableLoading,
    inspect,
    refetch,
    isDeprecated,
    isAuthorized,
    isModuleEnabled,
  } = useRiskScore({
    filterQuery,
    skip: !toggleStatus,
    pagination: {
      cursorStart: 0,
      querySize: 5,
    },
    timerange,
    riskEntity,
    includeAlertsCount: true,
  });

  useQueryInspector({
    queryId: entity.tableQueryId,
    loading: isTableLoading,
    refetch,
    setQuery,
    deleteQuery,
    inspect,
  });

  useEffect(() => {
    setUpdatedAt(Date.now());
  }, [isTableLoading, isKpiLoading]); // Update the time when data loads

  const refreshPage = useRefetchQueries();

  if (!isAuthorized) {
    return null;
  }

  const status = {
    isDisabled: !isModuleEnabled && !isTableLoading,
    isDeprecated: isDeprecated && !isTableLoading,
  };

  if (status.isDisabled || status.isDeprecated) {
    return (
      <EnableRiskScore
        {...status}
        entityType={riskEntity}
        refetch={refreshPage}
        timerange={timerange}
      />
    );
  }

  if (isModuleEnabled && selectedSeverity.length === 0 && data && data.length === 0) {
    return <RiskScoresNoDataDetected entityType={riskEntity} refetch={refreshPage} />;
  }

  return (
    <InspectButtonContainer>
      <Panel hasBorder data-test-subj={`entity_analytics_${riskEntity}s`}>
        <HeaderSection
          title={<RiskScoreHeaderTitle riskScoreEntity={riskEntity} />}
          titleSize="s"
          subtitle={
            <LastUpdatedAt isUpdating={isTableLoading || isKpiLoading} updatedAt={updatedAt} />
          }
          id={entity.tableQueryId}
          toggleStatus={toggleStatus}
          toggleQuery={setToggleStatus}
        >
          <RiskScoreHeaderContent
            entityLinkProps={entity.linkProps}
            onSelectSeverityFilterGroup={onSelectSeverityFilterGroup}
            riskEntity={riskEntity}
            selectedSeverity={selectedSeverity}
            severityCount={severityCount}
            toggleStatus={toggleStatus}
          />
        </HeaderSection>
        {toggleStatus && (
          <EuiFlexGroup data-test-subj="entity_analytics_content">
            <EuiFlexItem grow={false}>
              <ChartContent
                dataExists={data && data.length > 0}
                kpiQueryId={entity.kpiQueryId}
                riskEntity={riskEntity}
                severityCount={severityCount}
                timerange={timerange}
                selectedSeverity={selectedSeverity}
              />
            </EuiFlexItem>
            <EuiFlexItem>
              <StyledBasicTable
                responsive={false}
                items={data ?? []}
                columns={columns}
                loading={isTableLoading}
                id={entity.tableQueryId}
                rowProps={{
                  className: 'EntityAnalyticsTableHoverActions',
                }}
              />
            </EuiFlexItem>
          </EuiFlexGroup>
        )}
        {(isTableLoading || isKpiLoading) && (
          <Loader data-test-subj="loadingPanelRiskScore" overlay size="xl" />
        )}
      </Panel>
    </InspectButtonContainer>
  );
};

export const EntityAnalyticsRiskScores = React.memo(EntityAnalyticsRiskScoresComponent);
EntityAnalyticsRiskScores.displayName = 'EntityAnalyticsRiskScores';

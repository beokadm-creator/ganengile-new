/**
 * Memoized Components for Performance Optimization
 * React.memo, useMemo, useCallback applied versions
 */

import React, { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { GillerProfileCard as GillerProfileCardOriginal } from '../giller/GillerProfileCard';

// ==================== Memoized GillerProfileCard ====================

interface GillerProfileCardProps {
  giller: {
    id: string;
    name: string;
    profileImage?: string;
    rating: number;
    completedDeliveries: number;
    estimatedTime?: number;
    fee?: number;
  };
  onAccept: () => void;
  onReject: () => void;
  isAccepting?: boolean;
  isRejecting?: boolean;
}

// Custom comparison for GillerProfileCard props
function areGillerPropsEqual(
  prevProps: GillerProfileCardProps,
  nextProps: GillerProfileCardProps
): boolean {
  return (
    prevProps.giller.id === nextProps.giller.id &&
    prevProps.giller.name === nextProps.giller.name &&
    prevProps.giller.rating === nextProps.giller.rating &&
    prevProps.giller.completedDeliveries === nextProps.giller.completedDeliveries &&
    prevProps.isAccepting === nextProps.isAccepting &&
    prevProps.isRejecting === nextProps.isRejecting
  );
}

export const GillerProfileCard = memo(
  (props: GillerProfileCardProps) => {
    const handleAccept = useCallback(() => {
      props.onAccept();
    }, [props.onAccept]);

    const handleReject = useCallback(() => {
      props.onReject();
    }, [props.onReject]);

    return (
      <View style={styles.container}>
        {/* Profile Image */}
        <View style={styles.imageContainer}>
          {props.giller.profileImage ? (
            <Image
              source={{ uri: props.giller.profileImage }}
              style={styles.profileImage}
            />
          ) : (
            <View style={styles.defaultAvatar}>
              <Icon name="person" size={48} color="#00BCD4" />
            </View>
          )}
        </View>

        {/* Giller Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.name}>{props.giller.name}</Text>

          <View style={styles.ratingContainer}>
            <Icon name="star" size={20} color="#FFD700" />
            <Text style={styles.rating}>{props.giller.rating.toFixed(1)}</Text>
            <Text style={styles.deliveries}>
              완료 {props.giller.completedDeliveries}건
            </Text>
          </View>

          {props.giller.estimatedTime && (
            <View style={styles.row}>
              <Icon name="schedule" size={18} color="#666" />
              <Text style={styles.rowText}>
                예상 소요시간 {Math.floor(props.giller.estimatedTime / 60)}분
              </Text>
            </View>
          )}

          {props.giller.fee && (
            <View style={styles.row}>
              <Icon name="payments" size={18} color="#4CAF50" />
              <Text style={styles.feeText}>
                수수료 {props.giller.fee.toLocaleString()}원
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.rejectButton,
              (props.isRejecting || props.isAccepting) && styles.buttonDisabled,
            ]}
            onPress={handleReject}
            disabled={props.isRejecting || props.isAccepting}
            activeOpacity={0.7}
          >
            <Text style={styles.rejectButtonText}>거절</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.acceptButton,
              (props.isAccepting || props.isRejecting) && styles.buttonDisabled,
            ]}
            onPress={handleAccept}
            disabled={props.isAccepting || props.isRejecting}
            activeOpacity={0.7}
          >
            <Text style={styles.acceptButtonText}>
              {props.isAccepting ? '수락 중...' : '수락'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  },
  areGillerPropsEqual
);

// ==================== Memoized RouteItem ====================

interface RouteItemProps {
  route: {
    id: string;
    startStation: { name: string };
    endStation: { name: string };
    departureTime: string;
    daysOfWeek: number[];
    isActive: boolean;
  };
  onPress: (routeId: string) => void;
  onEdit: (routeId: string) => void;
  onDelete: (routeId: string) => void;
}

export const RouteItem = memo<RouteItemProps>((props) => {
  const handlePress = useCallback(() => {
    props.onPress(props.route.id);
  }, [props.route.id, props.onPress]);

  const handleEdit = useCallback(() => {
    props.onEdit(props.route.id);
  }, [props.route.id, props.onEdit]);

  const handleDelete = useCallback(() => {
    props.onDelete(props.route.id);
  }, [props.route.id, props.onDelete]);

  const dayLabels = useMemo(() => {
    const days = ['월', '화', '수', '목', '금', '토', '일'];
    return props.route.daysOfWeek.map(d => days[d - 1]).join(', ');
  }, [props.route.daysOfWeek]);

  return (
    <TouchableOpacity
      style={styles.routeContainer}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.routeInfo}>
        <Text style={styles.routeText}>
          {props.route.startStation.name} → {props.route.endStation.name}
        </Text>
        <Text style={styles.routeSubtext}>
          {props.route.departureTime} | {dayLabels}
        </Text>
      </View>

      <View style={styles.routeActions}>
        <TouchableOpacity onPress={handleEdit}>
          <Icon name="edit" size={20} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete}>
          <Icon name="delete" size={20} color="#FF5252" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

// ==================== Memoized RequestCard ====================

interface RequestCardProps {
  request: {
    id: string;
    pickupStation: { name: string };
    deliveryStation: { name: string };
    packageInfo: {
      size: string;
      weight: string;
    };
    fee: {
      totalFee: number;
    };
    status: string;
    createdAt: Date;
  };
  onPress: (requestId: string) => void;
  onAccept: (requestId: string) => void;
}

export const RequestCard = memo<RequestCardProps>((props) => {
  const handlePress = useCallback(() => {
    props.onPress(props.request.id);
  }, [props.request.id, props.onPress]);

  const handleAccept = useCallback(() => {
    props.onAccept(props.request.id);
  }, [props.request.id, props.onAccept]);

  const statusColor = useMemo(() => {
    switch (props.request.status) {
      case 'pending': return '#FF9800';
      case 'matched': return '#00BCD4';
      case 'in_progress': return '#4CAF50';
      case 'completed': return '#666';
      default: return '#666';
    }
  }, [props.request.status]);

  return (
    <TouchableOpacity
      style={styles.requestContainer}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.requestHeader}>
        <Text style={styles.requestText}>
          {props.request.pickupStation.name} → {props.request.deliveryStation.name}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{props.request.status}</Text>
        </View>
      </View>

      <View style={styles.requestDetails}>
        <Text style={styles.requestSubtext}>
          {props.request.packageInfo.size} | {props.request.packageInfo.weight}
        </Text>
        <Text style={styles.requestFee}>
          ₩{props.request.fee.totalFee.toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ==================== Optimized FlatList ====================

export function OptimizedFlatList<T>({
  data,
  renderItem,
  keyExtractor,
  ...rest
}: any) {
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      initialNumToRender={10}
      windowSize={5}
      {...rest}
    />
  );
}

// ==================== Styles ====================

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#00BCD4',
  },
  defaultAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E0F7FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#00BCD4',
  },
  infoContainer: {
    marginBottom: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  rating: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
    marginRight: 16,
  },
  deliveries: {
    fontSize: 14,
    color: '#666',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  rowText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  feeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  rejectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  acceptButton: {
    backgroundColor: '#00BCD4',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  routeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  routeInfo: {
    flex: 1,
  },
  routeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  routeSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  routeActions: {
    flexDirection: 'row',
    gap: 16,
  },
  requestContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 'bold',
  },
  requestDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestSubtext: {
    fontSize: 14,
    color: '#666',
  },
  requestFee: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
});

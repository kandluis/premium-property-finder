import React, { useState, useEffect, ReactElement } from 'react';
import styled from 'styled-components';

interface ProgressProps {
  progress: number;
}

const ProgressDiv = styled.div`
  background-color: rgb(233, 233, 233);
  border-radius: .5rem;
  width: 90%;
`;

const Progress = styled.div<ProgressProps>`
  background-color: rgb(62, 122, 235);
  height: 10px;
  border-radius: 1rem;
  transition: 1s ease;
  transition-delay: 0.5s;
  width: ${(props) => props.progress}%
`;

type ProgressBarProps = {
  percent: number;
};

export default function ProgressBar({ percent }: ProgressBarProps): ReactElement {
  const [value, setValue] = useState(0);

  useEffect(() => {
    setValue(100 * percent);
  }, [percent]);
  return (
    <ProgressDiv>
      <Progress progress={value} />
    </ProgressDiv>
  );
}
